
import React, { useState } from 'react';
import { Shield, ArrowRight, User, Loader2, Gamepad2, X, ChevronLeft } from 'lucide-react';
import { authService } from '../services/auth';
import { AuthUser } from '../types';

interface LoginPageProps {
    onLoginSuccess: (user: AuthUser) => void;
    onPlayAsGuest: () => void;
    onBack: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess, onPlayAsGuest, onBack }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        // Simulated delay for "security check"
        await new Promise(resolve => setTimeout(resolve, 500));

        // Pass password to auth service
        const user = await authService.login(email, password);
        
        if (user) {
            onLoginSuccess(user);
        } else {
            setError("Invalid credentials.");
        }
        setLoading(false);
    };

    return (
        <div className="fixed inset-0 z-[5000] bg-slate-950 flex items-center justify-center p-6 animate-in fade-in duration-300">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03] pointer-events-none" />
            
            <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-8 relative overflow-hidden animate-in zoom-in-95 duration-300">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 via-red-500 to-purple-600" />
                
                {/* Back Button */}
                <button 
                    onClick={onBack}
                    className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white transition-all text-[10px] font-bold uppercase tracking-widest border border-slate-700 z-10"
                >
                    Back to Hub <X className="w-3 h-3" />
                </button>

                <div className="text-center mb-8 mt-4">
                    <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-700 shadow-lg">
                        <Shield className="w-8 h-8 text-orange-500" />
                    </div>
                    <h1 className="text-2xl font-black text-white uppercase tracking-widest">System Access</h1>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">Authorized Personnel Only</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block ml-1">Email</label>
                        <input 
                            type="email" 
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white font-bold outline-none focus:border-orange-500 transition-colors"
                            placeholder="admin@teambattle.dk"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block ml-1">Password</label>
                        <input 
                            type="password" 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white font-bold outline-none focus:border-orange-500 transition-colors"
                            placeholder="••••••••"
                        />
                    </div>

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-center">
                            <p className="text-red-400 text-xs font-bold uppercase">{error}</p>
                        </div>
                    )}

                    <button 
                        type="submit" 
                        disabled={loading}
                        className="w-full py-4 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-black uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:grayscale"
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>LOGIN <ArrowRight className="w-5 h-5" /></>}
                    </button>
                </form>

                <div className="mt-8 pt-6 border-t border-slate-800 text-center">
                    <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest mb-4">Joining a game?</p>
                    <button 
                        onClick={onPlayAsGuest}
                        className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-colors border border-slate-700 hover:border-slate-600"
                    >
                        <Gamepad2 className="w-4 h-4" /> ENTER AS PLAYER
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
