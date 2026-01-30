import React from 'react';
import { Download, Check, AlertCircle } from 'lucide-react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

export const PreviewGrid = ({ assets }) => {
  const downloadAsset = (asset) => {
    const link = document.createElement('a');
    const filename = `asset_${asset.output_type}_${asset.language}_${asset.width}x${asset.height}.${asset.format}`;
    link.href = `data:image/${asset.format};base64,${asset.data}`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="preview-grid" data-testid="preview-grid">
      {assets.map((asset) => (
        <Card
          key={asset.id}
          className="p-4 hover:shadow-md transition-shadow duration-200"
          data-testid={`asset-card-${asset.id}`}
        >
          <div className="space-y-3">
            {/* Preview */}
            <div className="relative bg-muted rounded-sm overflow-hidden aspect-square">
              <img
                src={`data:image/${asset.format};base64,${asset.data}`}
                alt={asset.alt_text || `${asset.output_type} preview`}
                className="w-full h-full object-contain"
                data-testid={`asset-preview-${asset.id}`}
              />
            </div>

            {/* Info */}
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold capitalize truncate">
                    {asset.output_type.replace('_', ' ')}
                  </p>
                  <p className="text-xs font-mono text-muted-foreground">
                    {asset.width} × {asset.height} px
                  </p>
                </div>
                <Badge variant="secondary" className="uppercase text-xs">
                  {asset.format}
                </Badge>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Language:</span>
                <span className="font-medium">{asset.language}</span>
              </div>

              {/* Contrast Score */}
              {asset.contrast_score !== null && asset.contrast_score !== undefined && (
                <div className="flex items-center gap-2 text-xs">
                  {asset.contrast_score >= 50 ? (
                    <Check className="w-3 h-3 text-accent" />
                  ) : (
                    <AlertCircle className="w-3 h-3 text-destructive" />
                  )}
                  <span className="text-muted-foreground">Contrast:</span>
                  <span className="font-mono font-medium">{asset.contrast_score}%</span>
                </div>
              )}

              {/* Alt Text */}
              {asset.alt_text && (
                <p className="text-xs text-muted-foreground line-clamp-2" title={asset.alt_text}>
                  {asset.alt_text}
                </p>
              )}

              {/* Download Button */}
              <Button
                onClick={() => downloadAsset(asset)}
                variant="outline"
                size="sm"
                className="w-full rounded-sm"
                data-testid={`download-button-${asset.id}`}
              >
                <Download className="w-3 h-3 mr-2" />
                Download
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};

export default PreviewGrid;