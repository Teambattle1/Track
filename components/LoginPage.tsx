import React, { useState } from 'react';
import { Shield, User, Users, Edit, ArrowRight, Loader2, X, Lock } from 'lucide-react';
import { authService } from '../services/auth';
import { AuthUser } from '../types';

interface LoginPageProps {
    onLoginSuccess: (user: AuthUser, mode: 'EDITOR' | 'INSTRUCTOR' | 'TEAM') => void;
    onPlayAsGuest: () => void;
    onBack: () => void;
}

type LoginMode = 'SELECT' | 'EDITOR' | 'INSTRUCTOR' | 'TEAM';

const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess, onPlayAsGuest, onBack }) => {
    const [mode, setMode] = useState<LoginMode>('SELECT');
    
    // EDITOR login
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    
    // INSTRUCTOR login
    const [instructorCode, setInstructorCode] = useState('');
    
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleEditorLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        await new Promise(resolve => setTimeout(resolve, 500));

        const user = await authService.login(email, password);
        
        if (user) {
            onLoginSuccess(user, 'EDITOR');
        } else {
            setError("Invalid credentials.");
        }
        setLoading(false);
    };

    const handleInstructorLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        await new Promise(resolve => setTimeout(resolve, 500));

        if (instructorCode === '4027') {
            // Create instructor user
            const instructorUser: AuthUser = {
                id: 'instructor-temp',
                email: 'instructor@teambattle.dk',
                name: 'Instructor',
                role: 'instructor',
                createdAt: new Date().toISOString()
            };
            onLoginSuccess(instructorUser, 'INSTRUCTOR');
        } else {
            setError("Invalid instructor code.");
        }
        setLoading(false);
    };

    const handleTeamLogin = () => {
        // Redirect to team welcome screen
        onPlayAsGuest();
    };

    const handleBackToSelect = () => {
        setMode('SELECT');
        setError(null);
        setEmail('');
        setPassword('');
        setInstructorCode('');
    };

    // SELECTION SCREEN
    if (mode === 'SELECT') {
        return (
            <div className="fixed inset-0 z-[5000] bg-slate-950 flex items-center justify-center p-6 animate-in fade-in duration-300">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03] pointer-events-none" />
                
                <div className="w-full max-w-2xl">
                    {/* Header */}
                    <div className="text-center mb-12">
                        <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-red-600 rounded-3xl flex items-center justify-center mx-auto mb-6 border-4 border-white/10 shadow-2xl">
                            <Shield className="w-10 h-10 text-white" />
                        </div>
                        <h1 className="text-5xl font-black text-white uppercase tracking-widest mb-2">TeamAction</h1>
                        <p className="text-lg text-slate-500 font-bold uppercase tracking-wider">Select Your Access Level</p>
                    </div>

                    {/* 3 Pins */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        {/* TEAM Pin */}
                        <button
                            onClick={handleTeamLogin}
                            className="group relative bg-gradient-to-br from-green-600 to-emerald-700 rounded-3xl p-8 text-center transition-all hover:scale-105 active:scale-95 shadow-2xl border-4 border-white/10 hover:border-white/30 overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.1),transparent_70%)] opacity-0 group-hover:opacity-100 transition-opacity" />
                            <Users className="w-16 h-16 text-white mx-auto mb-4 relative z-10" />
                            <h2 className="text-2xl font-black text-white uppercase tracking-widest mb-2 relative z-10">Team</h2>
                            <p className="text-sm text-green-200 font-bold uppercase tracking-wider relative z-10">Join a Game</p>
                        </button>

                        {/* INSTRUCTOR Pin */}
                        <button
                            onClick={() => setMode('INSTRUCTOR')}
                            className="group relative bg-gradient-to-br from-orange-600 to-red-600 rounded-3xl p-8 text-center transition-all hover:scale-105 active:scale-95 shadow-2xl border-4 border-white/10 hover:border-white/30 overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.1),transparent_70%)] opacity-0 group-hover:opacity-100 transition-opacity" />
                            <User className="w-16 h-16 text-white mx-auto mb-4 relative z-10" />
                            <h2 className="text-2xl font-black text-white uppercase tracking-widest mb-2 relative z-10">Instructor</h2>
                            <p className="text-sm text-orange-200 font-bold uppercase tracking-wider relative z-10">Monitor Game</p>
                        </button>

                        {/* EDITOR Pin */}
                        <button
                            onClick={() => setMode('EDITOR')}
                            className="group relative bg-gradient-to-br from-purple-600 to-indigo-700 rounded-3xl p-8 text-center transition-all hover:scale-105 active:scale-95 shadow-2xl border-4 border-white/10 hover:border-white/30 overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.1),transparent_70%)] opacity-0 group-hover:opacity-100 transition-opacity" />
                            <Edit className="w-16 h-16 text-white mx-auto mb-4 relative z-10" />
                            <h2 className="text-2xl font-black text-white uppercase tracking-widest mb-2 relative z-10">Editor</h2>
                            <p className="text-sm text-purple-200 font-bold uppercase tracking-wider relative z-10">Full Access</p>
                        </button>
                    </div>

                    {/* Footer */}
                    <div className="text-center">
                        <p className="text-xs text-slate-600 font-bold uppercase tracking-widest">Powered by TeamAction</p>
                    </div>
                </div>
            </div>
        );
    }

    // EDITOR LOGIN SCREEN
    if (mode === 'EDITOR') {
        return (
            <div className="fixed inset-0 z-[5000] bg-slate-950 flex items-center justify-center p-6 animate-in fade-in duration-300">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03] pointer-events-none" />
                
                <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-8 relative overflow-hidden animate-in zoom-in-95 duration-300">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 via-indigo-500 to-purple-600" />
                    
                    {/* Back Button */}
                    <button 
                        onClick={handleBackToSelect}
                        className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white transition-all text-[10px] font-bold uppercase tracking-widest border border-slate-700 z-10"
                    >
                        <X className="w-3 h-3" />
                    </button>

                    <div className="text-center mb-8 mt-4">
                        <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-indigo-700 rounded-2xl flex items-center justify-center mx-auto mb-4 border-4 border-white/10 shadow-lg">
                            <Edit className="w-8 h-8 text-white" />
                        </div>
                        <h1 className="text-2xl font-black text-white uppercase tracking-widest">Editor Access</h1>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">Enter Your Credentials</p>
                    </div>

                    <form onSubmit={handleEditorLogin} className="space-y-4">
                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block ml-1">Email</label>
                            <input 
                                type="email" 
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white font-bold outline-none focus:border-purple-500 transition-colors"
                                placeholder="your@email.com"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block ml-1">Password</label>
                            <input 
                                type="password" 
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white font-bold outline-none focus:border-purple-500 transition-colors"
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
                            className="w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl font-black uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:grayscale"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>LOGIN <ArrowRight className="w-5 h-5" /></>}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    // INSTRUCTOR LOGIN SCREEN
    if (mode === 'INSTRUCTOR') {
        return (
            <div className="fixed inset-0 z-[5000] bg-slate-950 flex items-center justify-center p-6 animate-in fade-in duration-300">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03] pointer-events-none" />
                
                <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-8 relative overflow-hidden animate-in zoom-in-95 duration-300">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 via-red-500 to-orange-600" />
                    
                    {/* Back Button */}
                    <button 
                        onClick={handleBackToSelect}
                        className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white transition-all text-[10px] font-bold uppercase tracking-widest border border-slate-700 z-10"
                    >
                        <X className="w-3 h-3" />
                    </button>

                    <div className="text-center mb-8 mt-4">
                        <div className="w-16 h-16 bg-gradient-to-br from-orange-600 to-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border-4 border-white/10 shadow-lg">
                            <User className="w-8 h-8 text-white" />
                        </div>
                        <h1 className="text-2xl font-black text-white uppercase tracking-widest">Instructor Access</h1>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">Enter Access Code</p>
                    </div>

                    <form onSubmit={handleInstructorLogin} className="space-y-4">
                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block ml-1">Access Code</label>
                            <input 
                                type="text" 
                                required
                                value={instructorCode}
                                onChange={(e) => setInstructorCode(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-center text-white font-black text-2xl tracking-[0.5em] outline-none focus:border-orange-500 transition-colors"
                                placeholder="####"
                                maxLength={4}
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
                            className="w-full py-4 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white rounded-xl font-black uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:grayscale"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>ACCESS <Lock className="w-5 h-5" /></>}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">Code: 4027</p>
                    </div>
                </div>
            </div>
        );
    }

    return null;
};

export default LoginPage;
