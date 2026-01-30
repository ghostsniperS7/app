from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException, BackgroundTasks
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone
import base64
import asyncio
from PIL import Image
import io
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter, A2, A3
from reportlab.lib.utils import ImageReader

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Models
class OutputConfig(BaseModel):
    type: str  # poster, banner, ad, social_post, brochure
    language: str = "English"
    width: int
    height: int
    formats: List[str]  # png, jpeg, pdf, svg
    generate_print: bool = False  # Only for posters

class GlobalSettings(BaseModel):
    auto_alt_text: bool = True
    contrast_check: bool = True
    brand_guidelines: bool = False

class GenerateRequest(BaseModel):
    job_id: str
    outputs: List[OutputConfig]
    settings: GlobalSettings

class Job(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    image_data: str  # base64
    status: str = "pending"  # pending, processing, completed, failed
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    error: Optional[str] = None

class Asset(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    job_id: str
    output_type: str
    language: str
    width: int
    height: int
    format: str
    data: str  # base64
    alt_text: Optional[str] = None
    contrast_score: Optional[float] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AnalyzeImageRequest(BaseModel):
    image_data: str  # base64

class ContrastCheckRequest(BaseModel):
    image_data: str  # base64

# API Endpoints
@api_router.get("/")
async def root():
    return {"message": "Marketing Asset Generator API"}

@api_router.post("/upload")
async def upload_image(file: UploadFile = File(...)):
    """Upload an image and create a job"""
    try:
        # Validate file type
        if not file.content_type or not file.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="File must be an image")
        
        # Read and validate image
        contents = await file.read()
        try:
            img = Image.open(io.BytesIO(contents))
            img.verify()
            img = Image.open(io.BytesIO(contents))  # Reopen after verify
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid image file: {str(e)}")
        
        # Convert to base64
        image_base64 = base64.b64encode(contents).decode('utf-8')
        
        # Create job
        job = Job(image_data=image_base64)
        job_dict = job.model_dump()
        job_dict['created_at'] = job_dict['created_at'].isoformat()
        job_dict['updated_at'] = job_dict['updated_at'].isoformat()
        
        await db.jobs.insert_one(job_dict)
        
        return {"job_id": job.id, "status": job.status}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upload error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/generate")
async def generate_assets(request: GenerateRequest, background_tasks: BackgroundTasks):
    """Generate marketing assets from uploaded image"""
    try:
        # Get job
        job_doc = await db.jobs.find_one({"id": request.job_id}, {"_id": 0})
        if not job_doc:
            raise HTTPException(status_code=404, detail="Job not found")
        
        # Update job status
        await db.jobs.update_one(
            {"id": request.job_id},
            {"$set": {"status": "processing", "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        # Process in background
        background_tasks.add_task(
            process_generation,
            request.job_id,
            job_doc['image_data'],
            request.outputs,
            request.settings
        )
        
        return {"message": "Generation started", "job_id": request.job_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Generate error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

async def process_generation(job_id: str, image_data: str, outputs: List[OutputConfig], settings: GlobalSettings):
    """Background task to process asset generation"""
    try:
        api_key = os.getenv("EMERGENT_LLM_KEY")
        
        # Generate alt text if enabled
        alt_text = None
        if settings.auto_alt_text:
            alt_text = await generate_alt_text(image_data, api_key)
        
        # Process each output configuration
        for output_config in outputs:
            # Generate asset using Gemini
            chat = LlmChat(
                api_key=api_key,
                session_id=f"{job_id}_{output_config.type}_{uuid.uuid4()}",
                system_message="You are an expert marketing designer."
            )
            chat.with_model("gemini", "gemini-3-pro-image-preview").with_params(modalities=["image", "text"])
            
            # Create prompt based on output type and language
            prompt = create_generation_prompt(output_config)
            
            msg = UserMessage(
                text=prompt,
                file_contents=[ImageContent(image_data)]
            )
            
            text_response, images = await chat.send_message_multimodal_response(msg)
            
            if not images:
                logger.error(f"No image generated for {output_config.type}")
                continue
            
            # Process generated image
            generated_image_data = images[0]['data']
            
            # Resize to exact dimensions
            img_bytes = base64.b64decode(generated_image_data)
            img = Image.open(io.BytesIO(img_bytes))
            img_resized = img.resize((output_config.width, output_config.height), Image.Resampling.LANCZOS)
            
            # Save in each requested format
            for fmt in output_config.formats:
                asset_data = await convert_image_format(img_resized, fmt, output_config)
                
                # Calculate contrast if enabled
                contrast_score = None
                if settings.contrast_check:
                    contrast_score = await calculate_contrast(asset_data)
                
                # Create asset
                asset = Asset(
                    job_id=job_id,
                    output_type=output_config.type,
                    language=output_config.language,
                    width=output_config.width,
                    height=output_config.height,
                    format=fmt,
                    data=asset_data,
                    alt_text=alt_text,
                    contrast_score=contrast_score
                )
                
                asset_dict = asset.model_dump()
                asset_dict['created_at'] = asset_dict['created_at'].isoformat()
                
                await db.assets.insert_one(asset_dict)
            
            # Generate print versions for posters
            if output_config.type == "poster" and output_config.generate_print:
                await generate_print_versions(job_id, img_resized, output_config, alt_text)
        
        # Update job status to completed
        await db.jobs.update_one(
            {"id": job_id},
            {"$set": {"status": "completed", "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        
    except Exception as e:
        logger.error(f"Processing error: {str(e)}")
        await db.jobs.update_one(
            {"id": job_id},
            {"$set": {
                "status": "failed",
                "error": str(e),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )

def create_generation_prompt(output_config: OutputConfig) -> str:
    """Create a prompt for asset generation"""
    prompts = {
        "poster": f"Transform this product image into a professional marketing poster in {output_config.language}. Create a visually striking design with clear hierarchy, compelling headlines, and modern aesthetic. Size: {output_config.width}x{output_config.height}px.",
        "banner": f"Create a web banner advertisement in {output_config.language} from this product image. Design should be attention-grabbing with clear call-to-action. Optimized for {output_config.width}x{output_config.height}px.",
        "ad": f"Design a digital advertisement in {output_config.language} using this product image. Focus on conversion with compelling copy and strategic layout. Dimensions: {output_config.width}x{output_config.height}px.",
        "social_post": f"Create an engaging social media post graphic in {output_config.language} featuring this product. Eye-catching, shareable design optimized for {output_config.width}x{output_config.height}px.",
        "brochure": f"Design a brochure cover in {output_config.language} showcasing this product. Professional, informative, and visually appealing. Format: {output_config.width}x{output_config.height}px."
    }
    return prompts.get(output_config.type, prompts["poster"])

async def convert_image_format(img: Image.Image, fmt: str, output_config: OutputConfig) -> str:
    """Convert image to specified format and return base64"""
    buffer = io.BytesIO()
    
    if fmt.lower() == "png":
        img.save(buffer, format="PNG", optimize=True)
    elif fmt.lower() == "jpeg":
        if img.mode == "RGBA":
            img = img.convert("RGB")
        img.save(buffer, format="JPEG", quality=95, optimize=True)
    elif fmt.lower() == "pdf":
        # Create PDF
        pdf_buffer = io.BytesIO()
        c = canvas.Canvas(pdf_buffer, pagesize=(output_config.width, output_config.height))
        
        # Convert PIL image to bytes for reportlab
        img_buffer = io.BytesIO()
        if img.mode == "RGBA":
            img = img.convert("RGB")
        img.save(img_buffer, format="PNG")
        img_buffer.seek(0)
        
        img_reader = ImageReader(img_buffer)
        c.drawImage(img_reader, 0, 0, width=output_config.width, height=output_config.height)
        c.save()
        
        buffer = pdf_buffer
    elif fmt.lower() in ["svg", "ai", "psd"]:
        # For now, save as PNG (these formats require specialized libraries)
        img.save(buffer, format="PNG", optimize=True)
    
    buffer.seek(0)
    return base64.b64encode(buffer.read()).decode('utf-8')

async def generate_print_versions(job_id: str, img: Image.Image, output_config: OutputConfig, alt_text: Optional[str]):
    """Generate A2 and A3 print versions"""
    print_sizes = {
        "A2": (1191, 1684),  # A2 in pixels at 72 DPI
        "A3": (842, 1191)    # A3 in pixels at 72 DPI
    }
    
    for size_name, (width, height) in print_sizes.items():
        img_resized = img.resize((width, height), Image.Resampling.LANCZOS)
        
        # Save as PDF for print
        asset_data = await convert_image_format(img_resized, "pdf", 
            OutputConfig(type="poster", language=output_config.language, width=width, height=height, formats=["pdf"]))
        
        asset = Asset(
            job_id=job_id,
            output_type=f"poster_print_{size_name}",
            language=output_config.language,
            width=width,
            height=height,
            format="pdf",
            data=asset_data,
            alt_text=alt_text
        )
        
        asset_dict = asset.model_dump()
        asset_dict['created_at'] = asset_dict['created_at'].isoformat()
        
        await db.assets.insert_one(asset_dict)

async def generate_alt_text(image_data: str, api_key: str) -> str:
    """Generate alt text using Gemini"""
    try:
        chat = LlmChat(
            api_key=api_key,
            session_id=f"alt_text_{uuid.uuid4()}",
            system_message="You are an accessibility expert."
        )
        chat.with_model("gemini", "gemini-3-pro-image-preview").with_params(modalities=["image", "text"])
        
        msg = UserMessage(
            text="Generate a concise, descriptive alt text for this image focusing on key visual elements and purpose. Keep it under 125 characters.",
            file_contents=[ImageContent(image_data)]
        )
        
        text_response, _ = await chat.send_message_multimodal_response(msg)
        return text_response.strip()
    except Exception as e:
        logger.error(f"Alt text generation error: {str(e)}")
        return "Marketing asset image"

async def calculate_contrast(image_data: str) -> float:
    """Calculate basic contrast score (simplified)"""
    try:
        img_bytes = base64.b64decode(image_data)
        img = Image.open(io.BytesIO(img_bytes)).convert('L')  # Convert to grayscale
        pixels = list(img.getdata())
        
        # Calculate standard deviation as a contrast measure
        mean = sum(pixels) / len(pixels)
        variance = sum((p - mean) ** 2 for p in pixels) / len(pixels)
        std_dev = variance ** 0.5
        
        # Normalize to 0-100 scale
        contrast_score = min(100, (std_dev / 127.5) * 100)
        return round(contrast_score, 2)
    except Exception as e:
        logger.error(f"Contrast calculation error: {str(e)}")
        return 0.0

@api_router.get("/jobs/{job_id}")
async def get_job(job_id: str):
    """Get job status and details"""
    job_doc = await db.jobs.find_one({"id": job_id}, {"_id": 0, "image_data": 0})
    if not job_doc:
        raise HTTPException(status_code=404, detail="Job not found")
    return job_doc

@api_router.get("/assets/{job_id}")
async def get_assets(job_id: str):
    """Get all assets for a job"""
    assets = await db.assets.find({"job_id": job_id}, {"_id": 0}).to_list(1000)
    return {"assets": assets}

@api_router.post("/analyze")
async def analyze_image(request: AnalyzeImageRequest):
    """Generate alt text for an image"""
    try:
        api_key = os.getenv("EMERGENT_LLM_KEY")
        alt_text = await generate_alt_text(request.image_data, api_key)
        return {"alt_text": alt_text}
    except Exception as e:
        logger.error(f"Analysis error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/contrast-check")
async def check_contrast(request: ContrastCheckRequest):
    """Check color contrast of an image"""
    try:
        score = await calculate_contrast(request.image_data)
        status = "pass" if score >= 50 else "warning" if score >= 30 else "fail"
        return {"contrast_score": score, "status": status}
    except Exception as e:
        logger.error(f"Contrast check error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()