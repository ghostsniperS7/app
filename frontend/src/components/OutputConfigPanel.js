import React from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Checkbox } from './ui/checkbox';
import { Separator } from './ui/separator';

const OUTPUT_TYPES = [
  { id: 'poster', label: 'Poster', defaultWidth: 1080, defaultHeight: 1350 },
  { id: 'banner', label: 'Banner', defaultWidth: 1920, defaultHeight: 600 },
  { id: 'ad', label: 'Advertisement', defaultWidth: 1200, defaultHeight: 628 },
  { id: 'social_post', label: 'Social Post', defaultWidth: 1080, defaultHeight: 1080 },
  { id: 'brochure', label: 'Brochure', defaultWidth: 816, defaultHeight: 1056 },
];

const LANGUAGES = [
  'English',
  'Spanish',
  'French',
  'German',
  'Italian',
  'Portuguese',
  'Chinese',
  'Japanese',
  'Korean',
  'Arabic',
  'Hindi',
  'Russian',
];

const FORMATS = [
  { id: 'png', label: 'PNG' },
  { id: 'jpeg', label: 'JPEG' },
  { id: 'pdf', label: 'PDF' },
  { id: 'svg', label: 'SVG' },
];

export const OutputConfigPanel = ({
  outputs,
  setOutputs,
  globalSettings,
  setGlobalSettings,
  onGenerate,
  isGenerating,
  hasUploadedImage,
}) => {
  const addOutput = (type) => {
    const outputType = OUTPUT_TYPES.find((t) => t.id === type);
    const newOutput = {
      id: `${type}_${Date.now()}`,
      type,
      enabled: true,
      language: 'English',
      width: outputType.defaultWidth,
      height: outputType.defaultHeight,
      formats: ['png', 'jpeg', 'pdf'],
      generatePrint: type === 'poster',
    };
    setOutputs([...outputs, newOutput]);
  };

  const updateOutput = (id, field, value) => {
    setOutputs(
      outputs.map((output) =>
        output.id === id ? { ...output, [field]: value } : output
      )
    );
  };

  const toggleFormat = (outputId, format) => {
    setOutputs(
      outputs.map((output) => {
        if (output.id === outputId) {
          const formats = output.formats.includes(format)
            ? output.formats.filter((f) => f !== format)
            : [...output.formats, format];
          return { ...output, formats };
        }
        return output;
      })
    );
  };

  const removeOutput = (id) => {
    setOutputs(outputs.filter((output) => output.id !== id));
  };

  const enabledCount = outputs.filter((o) => o.enabled).length;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold tracking-normal mb-2" data-testid="config-panel-heading">
          Output Configuration
        </h3>
        <p className="text-xs text-muted-foreground">
          Configure your marketing assets
        </p>
      </div>

      <Separator />

      {/* Outputs */}
      <div className="space-y-4">
        <Accordion type="multiple" defaultValue={outputs.map((o) => o.id)} className="space-y-2">
          {outputs.map((output) => {
            const outputType = OUTPUT_TYPES.find((t) => t.id === output.type);
            return (
              <AccordionItem
                key={output.id}
                value={output.id}
                className="border border-border rounded-sm bg-background"
                data-testid={`output-config-${output.type}`}
              >
                <AccordionTrigger className="px-4 hover:no-underline hover:bg-muted/50">
                  <div className="flex items-center gap-3 w-full">
                    <Checkbox
                      checked={output.enabled}
                      onCheckedChange={(checked) => updateOutput(output.id, 'enabled', checked)}
                      onClick={(e) => e.stopPropagation()}
                      data-testid={`${output.type}-enabled-checkbox`}
                    />
                    <div className="flex-1 text-left">
                      <p className="font-medium">{outputType.label}</p>
                      <p className="text-xs font-mono text-muted-foreground">
                        {output.width} × {output.height} px
                      </p>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4 pt-2 space-y-4">
                  {/* Language */}
                  <div className="space-y-2">
                    <Label className="text-xs font-mono uppercase tracking-widest">Language</Label>
                    <Select
                      value={output.language}
                      onValueChange={(value) => updateOutput(output.id, 'language', value)}
                    >
                      <SelectTrigger data-testid={`${output.type}-language-select`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LANGUAGES.map((lang) => (
                          <SelectItem key={lang} value={lang}>
                            {lang}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Size */}
                  <div className="space-y-2">
                    <Label className="text-xs font-mono uppercase tracking-widest">Size (px)</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="number"
                        value={output.width}
                        onChange={(e) => updateOutput(output.id, 'width', parseInt(e.target.value) || 0)}
                        placeholder="Width"
                        className="h-12 font-mono"
                        data-testid={`${output.type}-width-input`}
                      />
                      <Input
                        type="number"
                        value={output.height}
                        onChange={(e) => updateOutput(output.id, 'height', parseInt(e.target.value) || 0)}
                        placeholder="Height"
                        className="h-12 font-mono"
                        data-testid={`${output.type}-height-input`}
                      />
                    </div>
                  </div>

                  {/* Formats */}
                  <div className="space-y-2">
                    <Label className="text-xs font-mono uppercase tracking-widest">Formats</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {FORMATS.map((format) => (
                        <div key={format.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`${output.id}-${format.id}`}
                            checked={output.formats.includes(format.id)}
                            onCheckedChange={() => toggleFormat(output.id, format.id)}
                            data-testid={`${output.type}-format-${format.id}-checkbox`}
                          />
                          <label
                            htmlFor={`${output.id}-${format.id}`}
                            className="text-sm cursor-pointer"
                          >
                            {format.label}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Print versions for posters */}
                  {output.type === 'poster' && (
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-mono uppercase tracking-widest">
                        Generate Print (A2/A3)
                      </Label>
                      <Switch
                        checked={output.generatePrint}
                        onCheckedChange={(checked) => updateOutput(output.id, 'generatePrint', checked)}
                        data-testid="poster-print-switch"
                      />
                    </div>
                  )}

                  {/* Remove button */}
                  {outputs.length > 1 && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => removeOutput(output.id)}
                      className="w-full rounded-sm"
                      data-testid={`${output.type}-remove-button`}
                    >
                      Remove
                    </Button>
                  )}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>

        {/* Add Output */}
        <Select onValueChange={addOutput}>
          <SelectTrigger className="h-12 border-2 border-dashed" data-testid="add-output-select">
            <div className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              <span>Add Output Type</span>
            </div>
          </SelectTrigger>
          <SelectContent>
            {OUTPUT_TYPES.map((type) => (
              <SelectItem key={type.id} value={type.id}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Separator />

      {/* Global Settings */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold uppercase tracking-widest" data-testid="global-settings-heading">
          Global Settings
        </h4>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm">Auto-generate Alt Text</Label>
            <Switch
              checked={globalSettings.auto_alt_text}
              onCheckedChange={(checked) =>
                setGlobalSettings({ ...globalSettings, auto_alt_text: checked })
              }
              data-testid="alt-text-switch"
            />
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-sm">Color Contrast Check</Label>
            <Switch
              checked={globalSettings.contrast_check}
              onCheckedChange={(checked) =>
                setGlobalSettings({ ...globalSettings, contrast_check: checked })
              }
              data-testid="contrast-check-switch"
            />
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-sm">Brand Guidelines</Label>
            <Switch
              checked={globalSettings.brand_guidelines}
              onCheckedChange={(checked) =>
                setGlobalSettings({ ...globalSettings, brand_guidelines: checked })
              }
              data-testid="brand-guidelines-switch"
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Generate Button */}
      <Button
        onClick={onGenerate}
        disabled={!hasUploadedImage || enabledCount === 0 || isGenerating}
        className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-14 uppercase tracking-wide font-bold rounded-sm"
        data-testid="generate-button"
      >
        {isGenerating ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Generating...
          </>
        ) : (
          `Generate ${enabledCount} Asset${enabledCount !== 1 ? 's' : ''}`
        )}
      </Button>

      {!hasUploadedImage && (
        <p className="text-xs text-center text-muted-foreground">
          Upload an image to start generating
        </p>
      )}
    </div>
  );
};

export default OutputConfigPanel;