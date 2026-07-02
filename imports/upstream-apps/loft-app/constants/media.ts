export const BACKGROUND_PRESETS = [
    { id: 'none', label: 'NONE', type: 'preset', value: '' },
    { id: 'blur', label: 'BLUR', type: 'preset', value: 'blur' },
    { id: 'studio', label: 'STUDIO', type: 'image', value: 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=800&q=80' },
    { id: 'minimal', label: 'MINIMAL', type: 'image', value: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=80' }
];

export interface MediaState {
  stream: MediaStream | null;
  isPreviewOn: boolean;
  selectedBgId: string;
  isModelLoading: boolean;
}
