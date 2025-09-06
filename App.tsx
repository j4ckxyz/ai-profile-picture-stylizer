import React, { useState, useCallback, useEffect } from 'react';
import ImageEditorModal from './components/ImageEditorModal';
import { stylizeImage as stylizeWithGemini } from './services/geminiService';
import { stylizeImageOpenRouter, validateOpenRouterKey, getOpenRouterModelId } from './services/openrouterService';
import { saveKeys, loadKeys, getProvider, setProvider, saveAppData, loadAppData, type Provider, type StoredKeys } from './services/keyStore';
import { DEFAULT_USAGE, addUsage, estimateTokensFromText, type Usage } from './services/usage';
import { THEMES } from './constants';

// --- Helper Types ---
interface HistoryItem {
  imageUrl: string;
  theme: string;
}

// --- Helper Components (defined outside App to prevent re-creation on re-renders) ---

const UploadIcon: React.FC = () => (
  <svg className="w-12 h-12 mb-4 text-gray-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16">
    <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2" />
  </svg>
);

const DownloadIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
  </svg>
);

const TrashIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" />
    </svg>
);

interface ImageUploaderProps {
  onFileSelect: (file: File) => void;
  originalImagePreview: string | null;
  onEdit?: () => void;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ onFileSelect, originalImagePreview, onEdit }) => {
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      onFileSelect(event.target.files[0]);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
  };
  
  const handleDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    if (event.dataTransfer.files && event.dataTransfer.files[0]) {
      onFileSelect(event.dataTransfer.files[0]);
    }
  };

  return (
    <div className="w-full lg:w-1/2 p-2 sm:p-4 flex flex-col items-center justify-center">
      <h2 className="text-lg sm:text-2xl font-bold mb-3 sm:mb-4 text-center text-gray-300">Your Picture</h2>
      <div className="w-full max-w-xs sm:max-w-sm aspect-square bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl shadow-lg flex items-center justify-center p-3 sm:p-4">
        {originalImagePreview ? (
          <img src={originalImagePreview} alt="Original profile" className="max-w-full max-h-full object-contain rounded-xl" />
        ) : (
          <label 
            htmlFor="file-upload" 
            className="flex flex-col items-center justify-center w-full h-full border-2 border-white/15 border-dashed rounded-xl cursor-pointer hover:bg-white/10 transition-colors"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <div className="flex flex-col items-center justify-center pt-4 sm:pt-5 pb-5 sm:pb-6 px-2">
              <UploadIcon />
              <p className="mb-2 text-xs sm:text-sm text-gray-400 text-center"><span className="font-semibold">Click to upload</span> or drag and drop</p>
              <p className="text-xs text-gray-500">PNG, JPG, or WEBP</p>
            </div>
            <input id="file-upload" type="file" className="hidden" accept="image/png, image/jpeg, image/webp" onChange={handleFileChange} />
          </label>
        )}
      </div>
       {originalImagePreview && (
         <div className="mt-3 sm:mt-4 flex gap-2">
           <label htmlFor="file-upload-change" className="px-3 sm:px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg cursor-pointer hover:bg-indigo-500 transition-colors">
              Change Picture
              <input id="file-upload-change" type="file" className="hidden" accept="image/png, image/jpeg, image/webp" onChange={handleFileChange} />
           </label>
           <button
             type="button"
             onClick={onEdit}
             className="px-3 sm:px-4 py-2 text-sm bg-white/10 border border-white/10 rounded-lg hover:bg-white/15 transition-colors"
           >Edit</button>
         </div>
       )}
    </div>
  );
};

interface ResultDisplayProps {
    isLoading: boolean;
    generatedImageUrl: string | null;
    error: string | null;
    onEdit?: () => void;
}

const ResultDisplay: React.FC<ResultDisplayProps> = ({ isLoading, generatedImageUrl, error, onEdit }) => (
    <div className="w-full lg:w-1/2 p-2 sm:p-4 flex flex-col items-center justify-center">
        <h2 className="text-lg sm:text-2xl font-bold mb-3 sm:mb-4 text-center text-gray-300">Stylized Picture</h2>
        <div className="w-full max-w-xs sm:max-w-sm aspect-square bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl shadow-lg flex items-center justify-center p-3 sm:p-4 relative overflow-hidden">
            {isLoading && (
                <div className="absolute inset-0 bg-black bg-opacity-60 flex flex-col items-center justify-center z-10">
                    <svg className="animate-spin -ml-1 mr-3 h-8 sm:h-10 w-8 sm:w-10 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p className="mt-4 text-sm sm:text-lg text-center px-2">Stylizing your picture...</p>
                </div>
            )}
            {error && !isLoading && (
                <div className="text-center text-red-400 px-2 sm:px-4">
                    <p className="font-semibold text-sm sm:text-base">An error occurred</p>
                    <p className="text-xs sm:text-sm">{error}</p>
                </div>
            )}
            {!isLoading && !generatedImageUrl && !error && (
                 <div className="text-center text-gray-500 px-2">
                    <p className="text-sm sm:text-base">Your generated image will appear here.</p>
                </div>
            )}
            {generatedImageUrl && (
                <img src={generatedImageUrl} alt="Generated profile" className="max-w-full max-h-full object-contain rounded-xl" />
            )}
        </div>
        {generatedImageUrl && !isLoading && (
          <div className="mt-3 sm:mt-4 flex gap-2">
            <a
              href={generatedImageUrl}
              download="stylized-profile-picture.png"
              className="px-4 sm:px-6 py-2 text-sm sm:text-base bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 focus:ring-offset-gray-900 transition-all flex items-center justify-center gap-2"
            >
              <DownloadIcon />
              Download
            </a>
            <button
              type="button"
              onClick={onEdit}
              className="px-4 sm:px-6 py-2 text-sm sm:text-base bg-white/10 border border-white/10 rounded-lg hover:bg-white/15"
            >Edit</button>
          </div>
        )}
    </div>
);

// --- New History Component ---

interface HistoryViewProps {
  history: HistoryItem[];
  onDelete: (index: number) => void;
  onClear: () => void;
}

const HistoryView: React.FC<HistoryViewProps> = ({ history, onDelete, onClear }) => (
  <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl shadow-2xl p-4 md:p-8">
    <div className="flex justify-between items-center mb-6">
      <h2 className="text-2xl font-bold text-gray-200">Generation History</h2>
      {history.length > 0 && (
        <button
          onClick={onClear}
          className="px-4 py-2 text-sm font-semibold rounded-lg transition-colors bg-red-600 hover:bg-red-700 text-white flex items-center gap-2"
          aria-label="Clear all history"
        >
          <TrashIcon />
          Clear All
        </button>
      )}
    </div>

    {history.length === 0 ? (
      <div className="text-center py-16">
        <p className="text-gray-400">Your generated images will appear here.</p>
        <p className="text-sm text-gray-500">Go back to the Stylizer to create your first image.</p>
      </div>
    ) : (
      <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
        {history.map((item, index) => (
          <div key={index} className="group relative bg-gray-800 rounded-lg overflow-hidden shadow-lg">
            <img src={item.imageUrl} alt={`Stylized with ${item.theme}`} className="w-full h-full object-cover aspect-square" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="absolute bottom-0 left-0 p-4 w-full">
                <p className="text-white font-bold truncate">{item.theme}</p>
                <div className="flex gap-2 mt-2">
                  <a
                    href={item.imageUrl}
                    download={`stylized-${item.theme.replace(/\s+/g, '-')}.png`}
                    className="flex-1 px-3 py-1.5 text-xs bg-green-600 text-white font-semibold rounded-md hover:bg-green-700 transition-colors flex items-center justify-center gap-1"
                  >
                    <DownloadIcon /> Download
                  </a>
                  <button
                    onClick={() => onDelete(index)}
                    className="p-1.5 text-xs bg-red-600 text-white font-semibold rounded-md hover:bg-red-700 transition-colors"
                    aria-label={`Delete image with theme ${item.theme}`}
                  >
                    <TrashIcon />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);


// --- Main App Component ---

export default function App() {
  const [originalImageFile, setOriginalImageFile] = useState<File | null>(null);
  const [originalImagePreview, setOriginalImagePreview] = useState<string | null>(null);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [customTheme, setCustomTheme] = useState<string>('');
  const [activeTheme, setActiveTheme] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [activeTab, setActiveTab] = useState<'stylizer' | 'history'>('stylizer');
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const [provider, setProviderState] = useState<Provider>('google');
  const [passphrase, setPassphrase] = useState<string>('');
  const [keys, setKeys] = useState<StoredKeys>({});
  const [googleValid, setGoogleValid] = useState<boolean | null>(null);
  const [openrouterValid, setOpenrouterValid] = useState<boolean | null>(null);
  const [usage, setUsage] = useState<Usage>({ ...DEFAULT_USAGE });
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallButton, setShowInstallButton] = useState<boolean>(false);
  const [editorOpen, setEditorOpen] = useState<boolean>(false);
  const [editorTarget, setEditorTarget] = useState<'input' | 'output' | null>(null);
  const [editorImageSrc, setEditorImageSrc] = useState<string | null>(null);

  // PWA Install functionality
  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallButton(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setShowInstallButton(false);
    }
    setDeferredPrompt(null);
  };

  // Load provider preference
  useEffect(() => {
    setProviderState(getProvider());
  }, []);

  // Validate keys when changed
  useEffect(() => {
    let cancelled = false;
    async function validate() {
      // Google: try a trivial call by creating client later; here we just check format length>=10
      if (keys.google) setGoogleValid(keys.google.trim().length > 10);
      else setGoogleValid(null);
      if (keys.openrouter) {
        const ok = await validateOpenRouterKey(keys.openrouter).catch(() => false);
        if (!cancelled) setOpenrouterValid(ok);
      } else {
        setOpenrouterValid(null);
      }
    }
    validate();
    return () => { cancelled = true; };
  }, [keys.google, keys.openrouter]);


  const handleFileSelect = (file: File) => {
    setOriginalImageFile(file);
    setGeneratedImageUrl(null);
    setError(null);
    setOriginalImagePreview(URL.createObjectURL(file));
  };

  const openEditorFor = (target: 'input' | 'output') => {
    if (target === 'input' && originalImagePreview) {
      setEditorTarget('input');
      setEditorImageSrc(originalImagePreview);
      setEditorOpen(true);
    } else if (target === 'output' && generatedImageUrl) {
      setEditorTarget('output');
      setEditorImageSrc(generatedImageUrl);
      setEditorOpen(true);
    }
  };

  const dataUrlToFile = async (dataUrl: string, filename = 'edited.png'): Promise<File> => {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    return new File([blob], filename, { type: 'image/png' });
  };

  const generateStyledImage = useCallback(async (theme: string) => {
    if (!originalImageFile || !theme) return;

    setIsLoading(true);
    setError(null);
    setActiveTheme(theme);
    setGeneratedImageUrl(null);

    try {
      const base64Image = await fileToBase64(originalImageFile);
      const { data, mimeType } = extractBase64(base64Image);
      
      const prompt = `Stylize this profile picture with a '${theme}' theme. Make it high-quality, vibrant, and suitable for a social media profile picture. Ensure the main subject of the image remains clearly recognizable.`;

      let stylizedImageBase64: string;
      if (provider === 'openrouter') {
        if (!keys.openrouter) throw new Error('Missing OpenRouter API key. Add it in Settings.');
        stylizedImageBase64 = await stylizeImageOpenRouter(data, mimeType, prompt, {
          apiKey: keys.openrouter,
        });
      } else {
        if (!keys.google) throw new Error('Missing Google Gemini API key. Add it in Settings.');
        stylizedImageBase64 = await stylizeWithGemini(data, mimeType, prompt, keys.google);
      }
      const newImageUrl = `data:image/png;base64,${stylizedImageBase64}`;
      setGeneratedImageUrl(newImageUrl);
      setHistory(prevHistory => [{ imageUrl: newImageUrl, theme }, ...prevHistory]);

      // Update estimated usage (prompt tokens only; image result has 0 tokens out)
      const promptTokens = estimateTokensFromText(prompt);
      setUsage(prev => addUsage(prev, promptTokens, 0));

    // FIX: Added opening brace for the catch block to fix syntax error.
    } catch (err: any) {
      console.error("Error generating image:", err);
      setError(err.message || 'Failed to generate image. Please try again.');
    } finally {
      setIsLoading(false);
      setActiveTheme(null);
    }
  }, [originalImageFile, provider, keys.google, keys.openrouter]);

  const handleCustomThemeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customTheme.trim()) {
      generateStyledImage(customTheme.trim());
    }
  };

  const deleteHistoryItem = (indexToDelete: number) => {
    setHistory(prevHistory => prevHistory.filter((_, index) => index !== indexToDelete));
  };

  const clearHistory = () => {
    setHistory([]);
  };

  // Persist app data (history + usage) when passphrase is set
  useEffect(() => {
    if (passphrase) {
      saveAppData({ history, usage }, passphrase).catch(() => {});
    }
  }, [history, usage, passphrase]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-gray-100 font-sans p-3 sm:p-4 lg:p-6 xl:p-8">
      <div className="container mx-auto max-w-7xl">
        <header className="mb-6 sm:mb-8 flex flex-col items-center gap-4">
          <div className="w-full flex flex-col sm:flex-row items-center justify-between bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl px-4 sm:px-5 py-4 shadow-xl shadow-black/30 gap-4 sm:gap-0">
            <div className="text-center sm:text-left">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight">
                AI Profile Picture <span className="text-indigo-400">Stylizer</span>
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-gray-400">Upload your picture, pick a theme, and let AI restyle it.</p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
              <CostPill usage={usage} />
              <ProviderPill provider={provider} googleValid={googleValid} openrouterValid={openrouterValid} />
              {showInstallButton && (
                <button
                  onClick={handleInstallClick}
                  className="px-3 sm:px-4 py-2 text-sm rounded-xl bg-green-600 hover:bg-green-500 transition shadow-md"
                  aria-label="Install App"
                >
                  📱 Install
                </button>
              )}
              <button
                onClick={() => setSettingsOpen(true)}
                className="px-3 sm:px-4 py-2 text-sm rounded-xl bg-indigo-600 hover:bg-indigo-500 transition shadow-md"
                aria-label="Open Settings"
              >Settings</button>
            </div>
          </div>
        </header>

        <div className="mb-6 flex justify-center border-b border-white/10">
          <button
            onClick={() => setActiveTab('stylizer')}
            className={`px-6 py-3 font-semibold transition-colors duration-200 ${activeTab === 'stylizer' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-gray-400 hover:text-white'}`}
            aria-current={activeTab === 'stylizer' ? 'page' : undefined}
          >
            Stylizer
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-6 py-3 font-semibold transition-colors duration-200 ${activeTab === 'history' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-gray-400 hover:text-white'}`}
            aria-current={activeTab === 'history' ? 'page' : undefined}
          >
            History
          </button>
        </div>

        {activeTab === 'stylizer' && (
          <main id="app-main" className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl shadow-2xl p-4 sm:p-6 lg:p-8">
            <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
               <ImageUploader onFileSelect={handleFileSelect} originalImagePreview={originalImagePreview} onEdit={() => openEditorFor('input')} />
               <ResultDisplay isLoading={isLoading} generatedImageUrl={generatedImageUrl} error={error} onEdit={() => openEditorFor('output')} />
            </div>

            {originalImageFile && (
              <div className="mt-8 lg:mt-10 pt-6 lg:pt-8 border-t border-white/10">
                <h3 className="text-lg sm:text-xl font-bold text-center mb-4 sm:mb-6">Choose a Style</h3>
                <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
                  {THEMES.map(theme => (
                    <button
                      key={theme}
                      onClick={() => generateStyledImage(theme)}
                      disabled={isLoading}
                      className="px-3 sm:px-5 py-2 text-xs sm:text-sm font-semibold rounded-full transition-all duration-200 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed bg-white/10 hover:bg-indigo-600/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 focus:ring-offset-slate-900 border border-white/10"
                    >
                      {isLoading && activeTheme === theme ? 'Generating...' : theme}
                    </button>
                  ))}
                </div>

                <form onSubmit={handleCustomThemeSubmit} className="mt-6 sm:mt-8 max-w-md mx-auto">
                  <p className="text-center font-semibold mb-3 text-sm sm:text-base">Or create your own theme:</p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={customTheme}
                      onChange={e => setCustomTheme(e.target.value)}
                      placeholder="e.g., '80s Retro Wave' or 'Steampunk'"
                      disabled={isLoading}
                      className="flex-grow bg-white/10 border border-white/10 rounded-lg px-4 py-2 text-sm sm:text-base focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition disabled:opacity-50 placeholder:text-gray-400"
                    />
                    <button
                      type="submit"
                      disabled={isLoading || !customTheme.trim()}
                      className="px-4 sm:px-6 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 focus:ring-offset-slate-900 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
                    >
                      {isLoading && activeTheme === customTheme.trim() ? '...' : 'Go'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </main>
        )}
        
        {activeTab === 'history' && (
          <HistoryView history={history} onDelete={deleteHistoryItem} onClear={clearHistory} />
        )}

        {settingsOpen && (
          <SettingsModal
            onClose={() => setSettingsOpen(false)}
            provider={provider}
            setProvider={(p) => { setProvider(p); setProviderState(p); }}
            keys={keys}
            setKeys={setKeys}
            passphrase={passphrase}
            setPassphrase={setPassphrase}
            googleValid={googleValid}
            openrouterValid={openrouterValid}
            onSave={async () => {
              await saveKeys(keys, passphrase || undefined);
              await saveAppData({ history, usage }, passphrase || undefined);
              setSettingsOpen(false);
            }}
            onLoad={async () => {
              const loadedKeys = await loadKeys(passphrase || undefined);
              if (loadedKeys) setKeys(loadedKeys);
              const app = await loadAppData<{ history: HistoryItem[]; usage: any }>(passphrase || undefined);
              if (app?.history) setHistory(app.history);
              if (app?.usage) setUsage(app.usage);
            }}
            onResetUsage={() => setUsage({ tokensIn: 0, tokensOut: 0, costUSD: 0 })}
            modelInfo={{ google: 'gemini-2.5-flash-image-preview', openrouter: getOpenRouterModelId() }}
          />
        )}

        {editorOpen && editorImageSrc && editorTarget && (
          <ImageEditorModal
            imageSrc={editorImageSrc}
            onClose={() => setEditorOpen(false)}
            onApply={async (url) => {
              if (editorTarget === 'input') {
                // Update preview and file
                setOriginalImagePreview(url);
                const f = await dataUrlToFile(url, 'edited-input.png');
                setOriginalImageFile(f);
              } else if (editorTarget === 'output') {
                setGeneratedImageUrl(url);
              }
              setEditorOpen(false);
            }}
          />
        )}

      </div>
    </div>
  );
}

// Helper functions
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

const extractBase64 = (dataUrl: string): { data: string; mimeType: string } => {
  const [header, data] = dataUrl.split(',');
  const mimeType = header.match(/:(.*?);/)?.[1] || 'application/octet-stream';
  return { data, mimeType };
};

// --- Settings UI ---

const Dot: React.FC<{ ok: boolean | null }> = ({ ok }) => (
  <span
    className={`inline-block w-2.5 h-2.5 rounded-full ml-2 ${
      ok === null ? 'bg-gray-500' : ok ? 'bg-green-500' : 'bg-red-500'
    }`}
    aria-hidden="true"
  />
);

const ProviderPill: React.FC<{ provider: Provider; googleValid: boolean | null; openrouterValid: boolean | null }>
  = ({ provider, googleValid, openrouterValid }) => (
  <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5">
    <span className="text-xs uppercase tracking-wide text-gray-300">{provider === 'google' ? 'Google Gemini' : 'OpenRouter'}</span>
    {provider === 'google' ? <Dot ok={googleValid} /> : <Dot ok={openrouterValid} />}
  </div>
);

// Shows estimated spend for this session (USD)
const CostPill: React.FC<{ usage: Usage }> = ({ usage }) => (
  <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5">
    <span className="text-xs text-gray-300">Est. Cost</span>
    <span className="text-xs font-semibold text-white">${usage.costUSD.toFixed(6)}</span>
  </div>
);

interface SettingsModalProps {
  onClose: () => void;
  provider: Provider;
  setProvider: (p: Provider) => void;
  keys: StoredKeys;
  setKeys: (k: StoredKeys) => void;
  passphrase: string;
  setPassphrase: (v: string) => void;
  googleValid: boolean | null;
  openrouterValid: boolean | null;
  onSave: () => Promise<void>;
  onLoad: () => Promise<void>;
  onResetUsage: () => void;
  modelInfo: { google: string; openrouter: string };
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  onClose, provider, setProvider, keys, setKeys, passphrase, setPassphrase, googleValid, openrouterValid, onSave, onLoad, onResetUsage, modelInfo
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white/10 backdrop-blur-2xl border border-white/15 rounded-2xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Settings</h2>
          <button onClick={onClose} className="text-gray-300 hover:text-white">Close</button>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">Provider</label>
            <div className="flex gap-3">
              <button
                className={`px-3 py-1.5 rounded-lg border ${provider === 'google' ? 'bg-indigo-600 border-indigo-400' : 'bg-white/5 border-white/10'}`}
                onClick={() => setProvider('google')}
              >Google Gemini</button>
              <button
                className={`px-3 py-1.5 rounded-lg border ${provider === 'openrouter' ? 'bg-indigo-600 border-indigo-400' : 'bg-white/5 border-white/10'}`}
                onClick={() => setProvider('openrouter')}
              >OpenRouter</button>
            </div>
            <p className="mt-2 text-xs text-gray-400">Toggle which provider to use for image generation. Model (fixed): Google = gemini-2.5-flash-image-preview, OpenRouter = {modelInfo.openrouter}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Google Gemini API Key <Dot ok={googleValid} /></label>
              <input
                type="password"
                className="w-full bg-white/10 border border-white/10 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="AIza..."
                value={keys.google || ''}
                onChange={(e) => setKeys({ ...keys, google: e.target.value })}
                autoComplete="off"
              />
              <p className="mt-1 text-xs text-gray-400">Create a key: https://aistudio.google.com/app/apikey. Note: On Sept 6–7, 2025 they made it free; otherwise it’s paid.</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">OpenRouter API Key <Dot ok={openrouterValid} /></label>
              <input
                type="password"
                className="w-full bg-white/10 border border-white/10 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="or-..."
                value={keys.openrouter || ''}
                onChange={(e) => setKeys({ ...keys, openrouter: e.target.value })}
                autoComplete="off"
              />
              <p className="mt-1 text-xs text-gray-400">Get a key: https://openrouter.ai/keys. Uses the same model via OpenRouter.</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Encryption Passphrase (optional but recommended)</label>
            <input
              type="password"
              className="w-full bg-white/10 border border-white/10 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Used to encrypt keys at rest"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              autoComplete="new-password"
            />
            <p className="mt-1 text-xs text-gray-400">When set, your keys, history and usage are AES‑GCM encrypted in localStorage. Without it, they stay only in memory for this session.</p>
          </div>

          <div className="flex items-center justify-between gap-3 pt-2">
            <button onClick={onResetUsage} className="px-4 py-2 rounded-lg bg-white/10 border border-white/10 hover:bg-white/15">Reset Usage</button>
            <div className="flex items-center gap-3">
              <button onClick={onLoad} className="px-4 py-2 rounded-lg bg-white/10 border border-white/10 hover:bg-white/15">Load</button>
              <button onClick={onSave} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500">Save</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
