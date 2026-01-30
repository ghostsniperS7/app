import React, { useState, useRef } from 'react';
import axios from 'axios';
import { Upload, FileImage, Loader2, Download, Check, AlertCircle, Image as ImageIcon } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import OutputConfigPanel from '../components/OutputConfigPanel';
import PreviewGrid from '../components/PreviewGrid';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const PLACEHOLDER_IMAGE = "https://images.unsplash.com/photo-1761156254622-7b66649b1f69?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxNzV8MHwxfHNlYXJjaHwxfHxhYnN0cmFjdCUyMGdlb21ldHJpYyUyMG1pbmltYWxpc3QlMjBwb3N0ZXIlMjBhcnR8ZW58MHx8fHwxNzY5Nzg5OTgxfDA&ixlib=rb-4.1.0&q=85";

const GeneratorPage = () => {
  const [uploadedImage, setUploadedImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [jobId, setJobId] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedAssets, setGeneratedAssets] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const [outputs, setOutputs] = useState([
    {
      id: 'poster',
      type: 'poster',
      enabled: true,
      language: 'English',
      width: 1080,
      height: 1350,
      formats: ['png', 'jpeg', 'pdf'],
      generatePrint: true,
    },
  ]);

  const [globalSettings, setGlobalSettings] = useState({
    auto_alt_text: true,
    contrast_check: true,
    brand_guidelines: false,
  });

  // Handle file upload
  const handleFileSelect = async (file) => {
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file (JPG, PNG, WEBP)');
      return;
    }

    setIsUploading(true);

    try {
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => setPreviewUrl(e.target.result);
      reader.readAsDataURL(file);

      // Upload to backend
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post(`${API}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setJobId(response.data.job_id);
      setUploadedImage(file);
      toast.success('Image uploaded successfully');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error.response?.data?.detail || 'Failed to upload image');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    handleFileSelect(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  // Generate assets
  const handleGenerate = async () => {
    if (!jobId) {
      toast.error('Please upload an image first');
      return;
    }

    const enabledOutputs = outputs.filter((o) => o.enabled);
    if (enabledOutputs.length === 0) {
      toast.error('Please enable at least one output type');
      return;
    }

    setIsGenerating(true);
    setGeneratedAssets([]);

    try {
      const request = {
        job_id: jobId,
        outputs: enabledOutputs.map((o) => ({
          type: o.type,
          language: o.language,
          width: o.width,
          height: o.height,
          formats: o.formats,
          generate_print: o.generatePrint || false,
        })),
        settings: globalSettings,
      };

      await axios.post(`${API}/generate`, request);
      toast.success('Generation started! This may take a moment...');

      // Poll for completion
      const pollInterval = setInterval(async () => {
        try {
          const jobResponse = await axios.get(`${API}/jobs/${jobId}`);
          
          if (jobResponse.data.status === 'completed') {
            clearInterval(pollInterval);
            
            // Fetch assets
            const assetsResponse = await axios.get(`${API}/assets/${jobId}`);
            setGeneratedAssets(assetsResponse.data.assets);
            setIsGenerating(false);
            toast.success(`Generated ${assetsResponse.data.assets.length} assets successfully!`);
          } else if (jobResponse.data.status === 'failed') {
            clearInterval(pollInterval);
            setIsGenerating(false);
            toast.error(jobResponse.data.error || 'Generation failed');
          }
        } catch (error) {
          clearInterval(pollInterval);
          setIsGenerating(false);
          console.error('Polling error:', error);
        }
      }, 3000);

      // Timeout after 5 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        if (isGenerating) {
          setIsGenerating(false);
          toast.error('Generation timed out. Please try again.');
        }
      }, 300000);
    } catch (error) {
      setIsGenerating(false);
      console.error('Generation error:', error);
      toast.error(error.response?.data?.detail || 'Failed to generate assets');
    }
  };

  // Download all assets
  const handleDownloadAll = () => {
    generatedAssets.forEach((asset, index) => {
      setTimeout(() => {
        const link = document.createElement('a');
        const filename = `asset_${asset.output_type}_${asset.language}_${asset.width}x${asset.height}.${asset.format}`;
        link.href = `data:image/${asset.format};base64,${asset.data}`;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }, index * 100);
    });
    toast.success('Downloading all assets...');
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-16 md:w-20 border-r border-border bg-card flex flex-col items-center py-8">
        <div className="flex flex-col gap-8 items-center">
          <div className="w-10 h-10 bg-primary rounded-sm flex items-center justify-center" data-testid="logo">
            <ImageIcon className="w-6 h-6 text-primary-foreground" />
          </div>
        </div>
      </aside>

      {/* Main Canvas */}
      <main className="flex-1 bg-background p-8 overflow-y-auto relative canvas-crosshair">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Header */}
          <div className="space-y-2">
            <h1 className="text-5xl font-black tracking-tighter leading-none uppercase text-balance" data-testid="main-heading">
              The Swiss Lab
            </h1>
            <p className="text-base text-muted-foreground font-body">
              Transform a single image into multiple ready-to-use marketing assets
            </p>
          </div>

          {/* Upload Zone */}
          <Card
            className={`p-12 border-2 border-dashed cursor-pointer upload-zone ${
              isDragging ? 'drag-active' : ''
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            data-testid="upload-zone"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => handleFileSelect(e.target.files[0])}
              className="hidden"
              data-testid="file-input"
            />
            
            <div className="flex flex-col items-center gap-4 text-center">
              {isUploading ? (
                <Loader2 className="w-12 h-12 animate-spin text-accent" />
              ) : uploadedImage ? (
                <>
                  <Check className="w-12 h-12 text-accent" />
                  <div>
                    <p className="font-semibold">{uploadedImage.name}</p>
                    <p className="text-xs font-mono text-muted-foreground mt-1">
                      {(uploadedImage.size / 1024).toFixed(0)} KB
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <Upload className="w-12 h-12 text-muted-foreground" />
                  <div>
                    <p className="font-semibold">Drop your image here or click to browse</p>
                    <p className="text-xs text-muted-foreground mt-1">JPG, PNG, or WEBP up to 10MB</p>
                  </div>
                </>
              )}
            </div>
          </Card>

          {/* Preview */}
          {previewUrl && (
            <Card className="p-6" data-testid="preview-card">
              <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-4">
                Preview
              </p>
              <div className="relative bg-muted rounded-sm overflow-hidden" style={{ maxHeight: '400px' }}>
                <img
                  src={previewUrl}
                  alt="Uploaded preview"
                  className="w-full h-full object-contain"
                  data-testid="preview-image"
                />
              </div>
            </Card>
          )}

          {/* Generated Assets */}
          {generatedAssets.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold tracking-tight" data-testid="generated-assets-heading">
                  Generated Assets
                </h2>
                <Button
                  onClick={handleDownloadAll}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 h-12 px-8 uppercase tracking-wide rounded-sm"
                  data-testid="download-all-button"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download All
                </Button>
              </div>
              <PreviewGrid assets={generatedAssets} />
            </div>
          )}
        </div>
      </main>

      {/* Config Panel */}
      <aside className="w-80 md:w-96 border-l border-border bg-card p-6 overflow-y-auto">
        <OutputConfigPanel
          outputs={outputs}
          setOutputs={setOutputs}
          globalSettings={globalSettings}
          setGlobalSettings={setGlobalSettings}
          onGenerate={handleGenerate}
          isGenerating={isGenerating}
          hasUploadedImage={!!jobId}
        />
      </aside>
    </div>
  );
};

export default GeneratorPage;