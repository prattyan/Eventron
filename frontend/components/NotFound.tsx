import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Home } from 'lucide-react';

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center text-center px-4">
      <div className="text-[10rem] font-black text-transparent bg-clip-text bg-gradient-to-b from-slate-800 to-slate-900 mb-4 select-none animate-float">
        404
      </div>
      <h2 className="text-3xl font-bold text-white mb-4 font-outfit">Lost in Space</h2>
      <p className="text-slate-400 max-w-md mx-auto mb-8 text-sm">
        The page or event you are looking for has vanished into the event horizon. Let's get you back on track.
      </p>
      <button 
        onClick={() => navigate('/explore')}
        className="px-8 py-4 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white rounded-xl font-bold transition-all shadow-lg shadow-orange-900/20 active:scale-95 flex items-center gap-2"
      >
        <Home className="w-5 h-5" />
        Return to Mission Control
      </button>
    </div>
  );
}
