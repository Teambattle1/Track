
import React, { useState, useEffect } from 'react';
import * as db from '../services/db';
import AdminModal from './AdminModal';
import { 
  X, Users, Mail, ChevronDown, UserPlus, Shield, Search, Check, Trash2, 
  Plus, AlertCircle, Clock, User, Loader2, Database, Terminal, RefreshCw,
  Key, Activity, History, Copy, Eye, EyeOff, Edit2, MessageSquare, Send
} from 'lucide-react';
import { AccountUser } from '../types';

// Valid Role List matching AuthUser type
const ROLES = [
  "Owner",
  "Admin",
  "Instructor",
  "Editor"
];

const AccountUsers: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  const [showAdminSetup, setShowAdminSetup] = useState(false);
  
  // Modal States
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AccountUser | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showActivityLogId, setShowActivityLogId] = useState<string | null>(null);

  // Users State
  const [users, setUsers] = useState<AccountUser[]>([]);

  // Add/Edit Form State
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'Instructor'
  });
  
  // Message State
  const [messageText, setMessageText] = useState('');
  const [messageSent, setMessageSent] = useState(false);

  const [generatedPasswordVisible, setGeneratedPasswordVisible] = useState(false);
  const [userCreatedSuccess, setUserCreatedSuccess] = useState<AccountUser | null>(null);

  // Load data
  const loadData = async () => {
    setLoading(true);
    setDbError(null);
    try {
        const fetchedUsers = await db.fetchAccountUsers();
        // If empty, allow seeding or create first user if needed
        if (fetchedUsers.length === 0) {
             // For demo purposes, create default admin if none exist
             // (In real app, this might be handled by signup or initial seed script)
        } 
        setUsers(fetchedUsers);
    } catch (e: any) {
        const message = e.message || String(e);
        if (message.includes('does not exist')) {
            setDbError("DATABASE_SETUP_REQUIRED");
        } else {
            console.error("Fetch error", e);
        }
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Poll for online status updates
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, []);

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  ).sort((a, b) => {
    // Primary Sort: Role Hierarchy
    const roleA = a.role.split(' - ')[0];
    const roleB = b.role.split(' - ')[0];
    const idxA = ROLES.indexOf(roleA);
    const idxB = ROLES.indexOf(roleB);
    
    // Put unknown roles at the end
    const valA = idxA === -1 ? 999 : idxA;
    const valB = idxB === -1 ? 999 : idxB;
    
    if (valA !== valB) return valA - valB;
    
    // Secondary Sort: Alphabetical by Name
    return a.name.localeCompare(b.name);
  });

  const handleDeleteUser = async (id: string) => {
    await db.deleteAccountUsers([id]);
    setUsers(users.filter(u => u.id !== id));
    setDeleteConfirmId(null);
    if(editingUser?.id === id) setEditingUser(null);
  };

  const generatePassword = () => {
      const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%";
      let pass = "";
      for (let i = 0; i < 10; i++) {
          pass += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      setUserForm({ ...userForm, password: pass });
  };

  const handleCreateUser = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!userForm.email || !userForm.password) return;

      const newUser: AccountUser = {
          id: `user-${Date.now()}`,
          name: userForm.name || 'New Agent',
          email: userForm.email,
          role: userForm.role,
          updatedAt: new Date().toLocaleDateString(),
          updatedBy: 'ADMIN',
          password: userForm.password,
          lastSeen: 0,
          usageHistory: []
      };

      await db.saveAccountUser(newUser);
      setUsers([...users, newUser]);
      setUserCreatedSuccess(newUser);
      setIsAddUserModalOpen(false);
      setUserForm({ name: '', email: '', password: '', role: 'Instructor' });
  };

  const handleUpdateUser = async () => {
      if (!editingUser) return;
      const updatedUser: AccountUser = {
          ...editingUser,
          name: userForm.name,
          role: userForm.role,
          // Only update password if changed (and non-empty in form, logic simplified for demo)
          password: userForm.password || editingUser.password, 
          updatedAt: new Date().toLocaleDateString()
      };
      
      await db.saveAccountUser(updatedUser);
      setUsers(users.map(u => u.id === editingUser.id ? updatedUser : u));
      setEditingUser(null);
  };

  const handleSendMessage = async () => {
      if (!editingUser || !messageText.trim()) return;
      
      const success = await db.sendAccountUserMessage(editingUser.id, messageText, "Admin");
      if (success) {
          setMessageSent(true);
          setTimeout(() => {
              setMessageSent(false);
              setMessageText('');
          }, 2000);
      }
  };

  const openEditModal = (user: AccountUser) => {
      setEditingUser(user);
      setUserForm({
          name: user.name,
          email: user.email,
          password: user.password || '',
          role: user.role.split(' - ')[0] // Normalize old roles if any
      });
      setMessageText('');
      setMessageSent(false);
  };

  const copyToClipboard = (text: string) => {
      navigator.clipboard.writeText(text);
      alert("Copied to clipboard!");
  };

  const isOnline = (lastSeen?: number) => {
      if (!lastSeen) return false;
      return Date.now() - lastSeen < 60000; // Active in last minute
  };

  const getLastActiveText = (lastSeen?: number) => {
      if (!lastSeen) return 'Never';
      if (isOnline(lastSeen)) return 'Online Now';
      const diff = Date.now() - lastSeen;
      const minutes = Math.floor(diff / 60000);
      if (minutes < 60) return `${minutes}m ago`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours}h ago`;
      return new Date(lastSeen).toLocaleDateString();
  };

  if (dbError === "DATABASE_SETUP_REQUIRED") {
      return (
          <div className="max-w-4xl mx-auto py-20 px-4 animate-in fade-in duration-500">
              <div className="bg-[#141414] border border-orange-500/30 rounded-3xl p-12 text-center shadow-2xl">
                  <div className="w-24 h-24 bg-orange-600/10 rounded-[2rem] flex items-center justify-center mx-auto mb-8 border border-orange-500/20">
                      <Terminal className="w-12 h-12 text-orange-500" />
                  </div>
                  <h2 className="text-4xl font-black text-white tracking-tight uppercase mb-4">Setup Required</h2>
                  <button onClick={() => setShowAdminSetup(true)} className="px-10 py-5 bg-[#00adef] hover:bg-[#0096ce] text-black font-black uppercase text-xs tracking-[0.2em] rounded-2xl transition-all shadow-xl shadow-blue-500/10 flex items-center justify-center gap-3 active:scale-95 mx-auto">
                      <Database className="w-5 h-5" /> RUN SQL SETUP
                  </button>
              </div>
              {showAdminSetup && <AdminModal games={[]} onClose={() => setShowAdminSetup(false)} onDeleteGame={() => {}} />}
          </div>
      );
  }

  return (
    <div className="max-w-[1600px] mx-auto animate-in fade-in duration-500 pb-20 px-4">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-10 mt-4">
        <div>
            <h1 className="text-4xl font-black text-white tracking-tight uppercase flex items-center gap-3">
                <Shield className="w-8 h-8 text-[#00adef]" /> 
                OPERATIVE DIRECTORY
            </h1>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-[0.3em] mt-2">
                MANAGE ACCESS AND CREDENTIALS
            </p>
        </div>
        
        <div className="flex items-center gap-4 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="SEARCH AGENTS..."
                className="w-full sm:w-64 bg-[#141414] border border-white/10 rounded-xl pl-12 pr-4 py-3 text-xs font-bold text-white outline-none focus:border-[#00adef] transition-all placeholder:text-slate-600"
              />
            </div>
            <button 
                onClick={() => {
                    setUserForm({ name: '', email: '', password: '', role: 'Instructor' });
                    setIsAddUserModalOpen(true);
                }}
                className="px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white font-black uppercase text-[11px] tracking-[0.2em] rounded-xl transition-all shadow-lg shadow-orange-600/20 flex items-center gap-2 hover:scale-105 active:scale-95"
            >
                <Plus className="w-4 h-4" /> ADD USER
            </button>
        </div>
      </div>

      {/* Success Banner */}
      {userCreatedSuccess && (
          <div className="mb-8 bg-green-900/20 border border-green-500/30 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 animate-in slide-in-from-top-4">
              <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center text-green-500">
                      <Check className="w-6 h-6" />
                  </div>
                  <div>
                      <h3 className="text-lg font-black text-white uppercase tracking-wide">USER CREATED SUCCESSFULLY</h3>
                      <p className="text-xs text-green-400 font-bold uppercase tracking-widest mt-1">SEND THESE DETAILS TO THE USER MANUALLY</p>
                  </div>
              </div>
              <div className="flex items-center gap-4 bg-black/40 p-3 rounded-xl border border-white/5 w-full md:w-auto">
                  <div className="text-center px-4 border-r border-white/10">
                      <div className="text-[9px] text-slate-500 font-black uppercase">EMAIL</div>
                      <div className="text-white font-bold">{userCreatedSuccess.email}</div>
                  </div>
                  <div className="text-center px-4">
                      <div className="text-[9px] text-slate-500 font-black uppercase">PASSWORD</div>
                      <div className="text-white font-mono font-bold tracking-widest">{userCreatedSuccess.password}</div>
                  </div>
                  <button onClick={() => copyToClipboard(`Email: ${userCreatedSuccess.email}\nPassword: ${userCreatedSuccess.password}`)} className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white">
                      <Copy className="w-4 h-4" />
                  </button>
              </div>
              <button onClick={() => setUserCreatedSuccess(null)} className="p-2 hover:bg-white/10 rounded-full text-slate-500">
                  <X className="w-5 h-5" />
              </button>
          </div>
      )}

      {/* Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredUsers.map(user => {
              const online = isOnline(user.lastSeen);
              const lastActiveText = getLastActiveText(user.lastSeen);
              
              return (
                  <div 
                    key={user.id} 
                    onClick={() => openEditModal(user)}
                    className={`bg-[#141414] border border-white/5 rounded-3xl p-6 shadow-xl hover:border-white/20 transition-all group relative overflow-hidden cursor-pointer ${online ? 'ring-1 ring-green-500/20' : ''}`}
                  >
                      {/* Trash Button - Stops Propagation */}
                      <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                          <button 
                            onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(user.id); }}
                            className="p-2 bg-red-900/20 text-red-500 hover:bg-red-600 hover:text-white rounded-xl transition-all"
                          >
                              <Trash2 className="w-4 h-4" />
                          </button>
                      </div>

                      <div className="flex items-start gap-4 mb-6">
                          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center border shadow-inner relative ${online ? 'bg-green-900/20 border-green-500/50' : 'bg-gradient-to-br from-slate-800 to-slate-900 border-white/5'}`}>
                              <User className={`w-8 h-8 ${online ? 'text-green-500' : 'text-slate-600'}`} />
                              {online && <div className="absolute top-1 right-1 w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse border border-black" />}
                          </div>
                          <div className="flex-1 min-w-0">
                              <h3 className="text-lg font-black text-white uppercase tracking-wide truncate">{user.name}</h3>
                              <p className="text-xs text-[#00adef] font-bold uppercase tracking-wider mt-1 truncate">{user.email}</p>
                              <div className="flex items-center gap-2 mt-2">
                                  <div className={`w-2 h-2 rounded-full ${online ? 'bg-green-500' : 'bg-slate-600'}`}></div>
                                  <span className={`text-[9px] font-bold uppercase tracking-widest ${online ? 'text-green-400' : 'text-slate-500'}`}>
                                      {lastActiveText}
                                  </span>
                              </div>
                          </div>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-[#0a0a0a] rounded-xl border border-white/5 mb-3 group-hover:border-white/10 transition-colors">
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">ROLE</span>
                          <span className={`text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded ${user.role.includes('Owner') ? 'text-yellow-500 bg-yellow-500/10' : 'text-white bg-white/10'}`}>
                              {user.role}
                          </span>
                      </div>

                      <button 
                        onClick={(e) => { e.stopPropagation(); setShowActivityLogId(user.id); }}
                        className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                      >
                          <Activity className="w-3 h-3" /> VIEW ACTIVITY LOG
                      </button>
                  </div>
              );
          })}
      </div>

      {/* EDIT USER / SEND MESSAGE MODAL */}
      {editingUser && (
          <div className="fixed inset-0 z-[6000] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
              <div className="bg-[#141414] border border-white/10 w-full max-w-lg rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                  
                  {/* Header */}
                  <div className="p-8 border-b border-white/5 bg-[#0a0a0a] flex justify-between items-start">
                      <div className="flex items-center gap-4">
                          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center border ${isOnline(editingUser.lastSeen) ? 'bg-green-900/20 border-green-500/50' : 'bg-slate-800 border-white/5'}`}>
                              <User className={`w-8 h-8 ${isOnline(editingUser.lastSeen) ? 'text-green-500' : 'text-slate-500'}`} />
                          </div>
                          <div>
                              <h3 className="text-xl font-black text-white uppercase tracking-widest leading-none">{editingUser.name}</h3>
                              <p className="text-xs text-[#00adef] font-bold uppercase tracking-wider mt-2">{editingUser.email}</p>
                              <div className="flex items-center gap-2 mt-2">
                                  <span className={`w-2 h-2 rounded-full ${isOnline(editingUser.lastSeen) ? 'bg-green-500' : 'bg-slate-600'}`}></span>
                                  <span className={`text-[10px] font-black uppercase tracking-widest ${isOnline(editingUser.lastSeen) ? 'text-green-500' : 'text-slate-500'}`}>
                                      {getLastActiveText(editingUser.lastSeen)}
                                  </span>
                              </div>
                          </div>
                      </div>
                      <button onClick={() => setEditingUser(null)} className="p-2 hover:bg-white/10 rounded-full text-slate-500 hover:text-white transition-colors">
                          <X className="w-6 h-6" />
                      </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-8">
                      
                      {/* Edit Form */}
                      <div className="space-y-4">
                          <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 mb-2">
                              <Edit2 className="w-3 h-3" /> EDIT DETAILS
                          </h4>
                          
                          <div className="grid grid-cols-2 gap-4">
                              <div className="col-span-2">
                                  <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1 block ml-1">FULL NAME</label>
                                  <input 
                                      type="text" 
                                      value={userForm.name}
                                      onChange={(e) => setUserForm({...userForm, name: e.target.value})}
                                      className="w-full bg-[#0f0f0f] border border-white/10 rounded-xl p-3 text-white font-bold outline-none focus:border-[#00adef] transition-all text-sm"
                                  />
                              </div>
                              <div>
                                  <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1 block ml-1">ROLE</label>
                                  <div className="relative">
                                      <select 
                                          value={userForm.role}
                                          onChange={(e) => setUserForm({...userForm, role: e.target.value})}
                                          className="w-full bg-[#0f0f0f] border border-white/10 rounded-xl p-3 text-white font-bold outline-none focus:border-[#00adef] transition-all text-sm appearance-none"
                                      >
                                          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                                      </select>
                                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                                  </div>
                              </div>
                              <div>
                                  <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1 block ml-1">PASSWORD (RESET)</label>
                                  <input 
                                      type="text" 
                                      value={userForm.password}
                                      onChange={(e) => setUserForm({...userForm, password: e.target.value})}
                                      placeholder={editingUser.password}
                                      className="w-full bg-[#0f0f0f] border border-white/10 rounded-xl p-3 text-white font-mono font-bold outline-none focus:border-[#00adef] transition-all text-sm"
                                  />
                              </div>
                          </div>
                          
                          <button 
                              onClick={handleUpdateUser}
                              className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-black uppercase text-[10px] tracking-[0.2em] transition-all"
                          >
                              SAVE CHANGES
                          </button>
                      </div>

                      {/* Message Section */}
                      <div className="space-y-4 pt-4 border-t border-white/5">
                          <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 mb-2">
                              <MessageSquare className="w-3 h-3" /> SEND MESSAGE TO SCREEN
                          </h4>
                          
                          <div className="relative">
                              <textarea 
                                  value={messageText}
                                  onChange={(e) => setMessageText(e.target.value)}
                                  placeholder="Type a message to popup on their screen..."
                                  className="w-full bg-[#0f0f0f] border border-white/10 rounded-xl p-4 text-white text-sm font-medium outline-none focus:border-[#00adef] transition-all min-h-[100px] resize-none"
                              />
                              <div className="absolute bottom-3 right-3">
                                  <button 
                                      onClick={handleSendMessage}
                                      disabled={!messageText.trim() || messageSent}
                                      className={`p-2 rounded-lg transition-all ${messageSent ? 'bg-green-600 text-white' : 'bg-[#00adef] text-black hover:bg-[#0096ce]'}`}
                                  >
                                      {messageSent ? <Check className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                                  </button>
                              </div>
                          </div>
                          <p className="text-[10px] text-slate-600 uppercase font-bold tracking-wide italic">
                              Message will appear instantly if online, or at next login.
                          </p>
                      </div>

                  </div>
              </div>
          </div>
      )}

      {/* ADD USER MODAL (Simplified) */}
      {isAddUserModalOpen && (
          <div className="fixed inset-0 z-[6000] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
              <div className="bg-[#141414] border border-white/10 w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl relative">
                  <div className="p-8 border-b border-white/5 bg-[#0a0a0a] flex justify-between items-center">
                      <h3 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-3">
                          <UserPlus className="w-6 h-6 text-orange-500" /> NEW OPERATIVE
                      </h3>
                      <button onClick={() => setIsAddUserModalOpen(false)}><X className="w-6 h-6 text-slate-500 hover:text-white" /></button>
                  </div>
                  
                  <form onSubmit={handleCreateUser} className="p-8 space-y-6">
                      <div className="space-y-4">
                          <div>
                              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block ml-1">FULL NAME</label>
                              <input 
                                  required 
                                  type="text" 
                                  placeholder="AGENT NAME" 
                                  className="w-full bg-[#0f0f0f] border border-white/10 rounded-xl p-3 text-white font-bold outline-none focus:border-orange-500 uppercase text-sm"
                                  value={userForm.name}
                                  onChange={(e) => setUserForm({...userForm, name: e.target.value})}
                              />
                          </div>
                          <div>
                              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block ml-1">EMAIL ADDRESS</label>
                              <input 
                                  required 
                                  type="email" 
                                  placeholder="agent@hq.com" 
                                  className="w-full bg-[#0f0f0f] border border-white/10 rounded-xl p-3 text-white font-bold outline-none focus:border-orange-500 text-sm"
                                  value={userForm.email}
                                  onChange={(e) => setUserForm({...userForm, email: e.target.value})}
                              />
                          </div>
                          <div>
                              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block ml-1">ROLE</label>
                              <div className="relative">
                                  <select 
                                      value={userForm.role} 
                                      onChange={(e) => setUserForm({...userForm, role: e.target.value})}
                                      className="w-full bg-[#0f0f0f] border border-white/10 rounded-xl p-3 text-white font-bold outline-none focus:border-orange-500 uppercase text-sm appearance-none"
                                  >
                                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                                  </select>
                                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                              </div>
                          </div>
                          <div>
                              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block ml-1 flex justify-between">
                                  <span>PASSWORD</span>
                                  <button type="button" onClick={generatePassword} className="text-orange-500 hover:text-orange-400 flex items-center gap-1"><RefreshCw className="w-3 h-3"/> GENERATE</button>
                              </label>
                              <div className="relative">
                                  <input 
                                      required 
                                      type={generatedPasswordVisible ? 'text' : 'password'} 
                                      placeholder="••••••••" 
                                      className="w-full bg-[#0f0f0f] border border-white/10 rounded-xl p-3 text-white font-mono font-bold outline-none focus:border-orange-500 text-sm pr-10"
                                      value={userForm.password}
                                      onChange={(e) => setUserForm({...userForm, password: e.target.value})}
                                  />
                                  <button type="button" onClick={() => setGeneratedPasswordVisible(!generatedPasswordVisible)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                                      {generatedPasswordVisible ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                                  </button>
                              </div>
                          </div>
                      </div>
                      
                      <button type="submit" className="w-full py-4 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-black uppercase tracking-[0.2em] shadow-lg flex items-center justify-center gap-3 transition-all active:scale-95">
                          CREATE USER
                      </button>
                  </form>
              </div>
          </div>
      )}

      {/* ACTIVITY LOG MODAL */}
      {showActivityLogId && (
          <div className="fixed inset-0 z-[6000] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
              <div className="bg-[#141414] border border-white/10 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl h-[600px] flex flex-col">
                  <div className="p-6 border-b border-white/5 bg-[#0a0a0a] flex justify-between items-center shrink-0">
                      <div>
                          <h3 className="text-lg font-black text-white uppercase tracking-widest flex items-center gap-2">
                              <History className="w-5 h-5 text-blue-500" /> ACTIVITY LOG
                          </h3>
                          <p className="text-[10px] text-slate-500 font-bold uppercase mt-1 tracking-wide">
                              USER: {users.find(u => u.id === showActivityLogId)?.name}
                          </p>
                      </div>
                      <button onClick={() => setShowActivityLogId(null)} className="p-2 hover:bg-white/5 rounded-full text-slate-500 hover:text-white"><X className="w-5 h-5" /></button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                      {(users.find(u => u.id === showActivityLogId)?.usageHistory || []).length === 0 ? (
                          <div className="h-full flex flex-col items-center justify-center text-slate-600 opacity-50">
                              <History className="w-12 h-12 mb-3" />
                              <p className="text-xs font-black uppercase tracking-widest">NO RECORDED ACTIVITY</p>
                          </div>
                      ) : (
                          users.find(u => u.id === showActivityLogId)?.usageHistory?.map((log, i) => (
                              <div key={i} className="flex gap-4 p-4 bg-[#0a0a0a] border border-white/5 rounded-xl">
                                  <div className="flex flex-col items-center">
                                      <div className="w-2 h-2 bg-blue-500 rounded-full mb-1"></div>
                                      <div className="w-px h-full bg-blue-500/20"></div>
                                  </div>
                                  <div>
                                      <h4 className="text-xs font-black text-white uppercase tracking-wide">{log.action}</h4>
                                      <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 flex items-center gap-2">
                                          <Shield className="w-3 h-3 text-slate-600" /> {log.gameName}
                                      </p>
                                      <p className="text-[9px] text-slate-600 font-mono mt-1">{log.date}</p>
                                  </div>
                              </div>
                          ))
                      )}
                  </div>
              </div>
          </div>
      )}

      {/* DELETE CONFIRM */}
      {deleteConfirmId && (
          <div className="fixed inset-0 z-[6000] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
              <div className="bg-[#141414] border border-red-500/30 w-full max-w-sm rounded-3xl p-8 text-center shadow-2xl">
                  <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                  <h3 className="text-xl font-black text-white uppercase tracking-widest mb-2">REVOKE ACCESS?</h3>
                  <p className="text-xs text-slate-500 font-bold uppercase mb-8">THIS ACTION CANNOT BE UNDONE.</p>
                  <div className="flex gap-3">
                      <button onClick={() => setDeleteConfirmId(null)} className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-black uppercase text-xs tracking-widest">CANCEL</button>
                      <button onClick={() => handleDeleteUser(deleteConfirmId)} className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-lg">CONFIRM</button>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

export default AccountUsers;
