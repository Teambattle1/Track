import React, { useState, useEffect } from 'react';
import * as db from '../services/db';
import AdminModal from './AdminModal';
import { 
  X, Users, Mail, ChevronDown, ChevronRight, ChevronLeft, 
  UserPlus, Shield, Search, Check, Trash2, Plus, AlertCircle, 
  MoreHorizontal, Clock, User, Loader2, Database, Terminal, RefreshCw
} from 'lucide-react';

interface AccountUser {
  id: string;
  name: string;
  email: string;
  role: string;
  updatedAt: string;
  updatedBy: string;
}

interface UserInvite {
  id: string;
  email: string;
  role: string;
  sentAt: string;
  status: 'pending' | 'expired';
}

const ROLES = [
  "Owner - full access",
  "Admin - manage content and users",
  "Full - manage games and tasks",
  "Instructor - run and test games",
  "Viewer - read only access",
  "Disabled - no access"
];

const AccountUsers: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'USERS' | 'INVITES'>('USERS');
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  const [showAdminSetup, setShowAdminSetup] = useState(false);
  
  // Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Modal States
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isBulkDeleteMode, setIsBulkDeleteMode] = useState(false);

  // Users & Invites State
  const [users, setUsers] = useState<AccountUser[]>([]);
  const [invites, setInvites] = useState<UserInvite[]>([]);

  // Form State
  const [inviteForm, setInviteForm] = useState({
    name: '',
    email: '',
    role: ROLES[2] // Default to "Full"
  });

  // Load data from Supabase
  const loadData = async () => {
    setLoading(true);
    setDbError(null);
    try {
        const fetchedUsers = await db.fetchAccountUsers();
        const fetchedInvites = await db.fetchAccountInvites();

        if (fetchedUsers.length === 0) {
            // Seed defaults if totally empty (first run)
            const defaults: AccountUser[] = [
                { id: '1', name: 'Jesper Tørslev-Thomsen', email: 'ntj1973@hotmail.com', role: ROLES[2], updatedAt: 'AUG 20, 2025', updatedBy: 'THOMAS SUNKE' },
                { id: '2', name: 'Kim Schroder', email: 'kim.schroder@gmail.com', role: ROLES[2], updatedAt: 'AUG 20, 2025', updatedBy: 'THOMAS SUNKE' },
                { id: '3', name: 'Maria', email: 'maria@teambattle.dk', role: ROLES[0], updatedAt: 'NOV 6, 2024', updatedBy: 'THOMAS SUNKE' },
                { id: '4', name: 'Game Master', email: 'sagi@christiansen.ee', role: ROLES[0], updatedAt: 'MAY 24, 2024', updatedBy: 'THOMAS SUNKE' },
                { id: '5', name: 'Thomas Sunke', email: 'thomas@teambattle.dk', role: ROLES[0], updatedAt: 'OCT 7, 2022', updatedBy: 'THOMAS SUNKE' },
            ];
            // Attempt to save seeds (might fail if table missing)
            try {
                for (const u of defaults) await db.saveAccountUser(u);
            } catch (e) {}
            setUsers(defaults);
        } else {
            setUsers(fetchedUsers);
        }
        setInvites(fetchedInvites);
    } catch (e: any) {
        const message = e.message || (typeof e === 'object' ? JSON.stringify(e) : String(e));
        const errCode = e.code || (message.includes('does not exist') ? '42P01' : '');
        console.error("Supabase sync failed:", message);
        
        if (errCode === '42P01') {
            setDbError("DATABASE_SETUP_REQUIRED");
        } else {
            setDbError(message || "Failed to sync with Supabase.");
        }
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredUsers.length && filteredUsers.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredUsers.map(u => u.id)));
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    const timestamp = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
    const updatedUser = users.find(u => u.id === userId);
    if (!updatedUser) return;

    const nextUser = { 
        ...updatedUser, 
        role: newRole, 
        updatedAt: timestamp,
        updatedBy: 'SYSTEM ADMIN' 
    };

    setUsers(users.map(u => u.id === userId ? nextUser : u));
    setOpenDropdownId(null);
    
    try {
        await db.saveAccountUser(nextUser);
    } catch (e: any) {
        const message = e.message || (typeof e === 'object' ? JSON.stringify(e) : String(e));
        console.error("Update failed:", message);
        alert(`Update failed: ${message}. Please check DB setup.`);
    }
  };

  const handleDeleteUser = async (id: string) => {
    try {
        await db.deleteAccountUsers([id]);
        setUsers(users.filter(u => u.id !== id));
        setDeleteConfirmId(null);
        const nextSelected = new Set(selectedIds);
        nextSelected.delete(id);
        setSelectedIds(nextSelected);
    } catch (e: any) {
        const message = e.message || (typeof e === 'object' ? JSON.stringify(e) : String(e));
        console.error("Deletion failed:", message);
        alert(`Deletion failed: ${message}`);
    }
  };

  const handleBulkDelete = async () => {
    const idsToPurge = Array.from(selectedIds) as string[];
    try {
        await db.deleteAccountUsers(idsToPurge);
        setUsers(users.filter(u => !selectedIds.has(u.id)));
        setSelectedIds(new Set());
        setDeleteConfirmId(null);
        setIsBulkDeleteMode(false);
    } catch (e: any) {
        const message = e.message || (typeof e === 'object' ? JSON.stringify(e) : String(e));
        console.error("Bulk deletion failed:", message);
        alert(`Bulk deletion failed: ${message}`);
    }
  };

  const handleDeleteInvite = async (id: string) => {
    try {
        await db.deleteAccountInvite(id);
        setInvites(invites.filter(i => i.id !== id));
    } catch (e: any) {
        const message = e.message || (typeof e === 'object' ? JSON.stringify(e) : String(e));
        console.error("Revoke invite failed:", message);
    }
  };

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteForm.email) return;

    const newInvite: UserInvite = {
      id: `inv-${Date.now()}`,
      email: inviteForm.email,
      role: inviteForm.role,
      sentAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase(),
      status: 'pending'
    };

    try {
        await db.saveAccountInvite(newInvite);
        setInvites([...invites, newInvite]);
        setIsInviteModalOpen(false);
        setInviteForm({ name: '', email: '', role: ROLES[2] });
        setActiveSubTab('INVITES');
    } catch (err: any) {
        const message = err.message || (typeof err === 'object' ? JSON.stringify(err) : String(err));
        console.error("Invitation failed:", message);
        alert(`Invitation failed: ${message}`);
    }
  };

  if (dbError === "DATABASE_SETUP_REQUIRED") {
      return (
          <div className="max-w-4xl mx-auto py-20 px-4 animate-in fade-in duration-500">
              <div className="bg-[#141414] border border-orange-500/30 rounded-3xl p-12 text-center shadow-2xl">
                  <div className="w-24 h-24 bg-orange-600/10 rounded-[2rem] flex items-center justify-center mx-auto mb-8 border border-orange-500/20">
                      <Terminal className="w-12 h-12 text-orange-500" />
                  </div>
                  <h2 className="text-4xl font-black text-white tracking-tight uppercase mb-4">Setup Required</h2>
                  <p className="text-gray-500 text-lg font-medium leading-relaxed mb-10 max-w-lg mx-auto uppercase tracking-widest text-xs">
                      The operative management system requires backend database initialization before access can be granted.
                  </p>
                  <div className="flex flex-col sm:flex-row justify-center gap-4">
                    <button 
                        onClick={() => setShowAdminSetup(true)}
                        className="px-10 py-5 bg-[#00adef] hover:bg-[#0096ce] text-black font-black uppercase text-xs tracking-[0.2em] rounded-2xl transition-all shadow-xl shadow-blue-500/10 flex items-center justify-center gap-3 active:scale-95"
                    >
                        <Database className="w-5 h-5" /> RUN SQL SETUP
                    </button>
                    <button 
                        onClick={() => loadData()}
                        className="px-10 py-5 bg-white/5 hover:bg-white/10 text-white font-black uppercase text-xs tracking-[0.2em] rounded-2xl transition-all flex items-center justify-center gap-3"
                    >
                        <RefreshCw className="w-5 h-5" /> RE-CHECK STATUS
                    </button>
                  </div>
              </div>
              
              {showAdminSetup && (
                  <AdminModal 
                      games={[]} 
                      onClose={() => setShowAdminSetup(false)} 
                      onDeleteGame={() => {}} 
                  />
              )}
          </div>
      );
  }

  return (
    <div className="max-w-[1400px] mx-auto animate-in fade-in duration-500 pb-20 px-4">
      
      {/* Page Header */}
      <div className="flex justify-between items-center mb-10 mt-4">
        <h1 className="text-4xl font-black text-white tracking-tight">Account Users</h1>
        
        {/* Top Right Toggle */}
        <div className="flex bg-[#141414] p-1 rounded-xl border border-white/5 shadow-2xl">
          <button 
            onClick={() => setActiveSubTab('USERS')}
            className={`px-6 py-2 rounded-lg text-[11px] font-black tracking-[0.15em] flex items-center gap-2 transition-all ${activeSubTab === 'USERS' ? 'bg-[#2a2a2a] text-white shadow-xl' : 'text-gray-500 hover:text-gray-300'}`}
          >
            <Users className="w-4 h-4" /> USERS
          </button>
          <button 
            onClick={() => setActiveSubTab('INVITES')}
            className={`px-6 py-2 rounded-lg text-[11px] font-black tracking-[0.15em] flex items-center gap-2 transition-all ${activeSubTab === 'INVITES' ? 'bg-[#2a2a2a] text-white shadow-xl' : 'text-gray-500 hover:text-gray-300'}`}
          >
            <Mail className="w-4 h-4" /> INVITES
          </button>
        </div>
      </div>

      <div className="bg-[#0f0f0f] border border-white/5 rounded-2xl overflow-visible shadow-2xl relative min-h-[400px]">
        
        {/* Table Top Bar */}
        <div className="p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/5">
          <div className="flex items-center gap-8">
            <h2 className="text-2xl font-black text-white tracking-tight">
                {activeSubTab === 'USERS' ? 'Users' : 'Pending Invitations'}
                {loading && <Loader2 className="inline-block ml-3 w-5 h-5 animate-spin text-[#00adef]" />}
            </h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter members..."
                className="bg-[#181818] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold text-white outline-none focus:border-[#00adef] transition-all w-72 placeholder-gray-700"
              />
            </div>
          </div>
          <button 
            onClick={() => setIsInviteModalOpen(true)}
            className="px-8 py-3 bg-[#00adef] hover:bg-[#0096ce] text-black font-black uppercase text-[11px] tracking-[0.2em] rounded-xl transition-all shadow-lg shadow-[#00adef]/10 flex items-center gap-3 active:scale-95"
          >
            INVITE USER
          </button>
        </div>

        {/* Bulk Action Header Placeholder */}
        <div className="grid grid-cols-[60px_1fr_400px_200px] gap-4 px-8 py-5 bg-[#0a0a0a] border-b border-white/5 items-center">
          <div className="flex justify-center">
            <div 
              onClick={toggleSelectAll}
              className={`w-5 h-5 border-2 rounded-md cursor-pointer transition-all flex items-center justify-center ${selectedIds.size > 0 ? 'bg-[#00adef] border-[#00adef]' : 'border-white/10 hover:border-white/30'}`}
            >
              {selectedIds.size === filteredUsers.length && selectedIds.size > 0 ? (
                <Check className="w-3.5 h-3.5 text-black stroke-[4]" />
              ) : selectedIds.size > 0 ? (
                <div className="w-2 h-0.5 bg-black rounded-full" />
              ) : null}
            </div>
          </div>
          <div className="text-[10px] font-black text-gray-600 uppercase tracking-[0.25em]">{activeSubTab === 'USERS' ? 'USER' : 'EMAIL'}</div>
          <div className="text-[10px] font-black text-gray-600 uppercase tracking-[0.25em]">{activeSubTab === 'USERS' ? 'ROLE' : 'ASSIGNED ROLE'}</div>
          <div className="text-[10px] font-black text-gray-600 uppercase tracking-[0.25em] flex items-center gap-1 justify-end">
            {activeSubTab === 'USERS' ? 'UPDATED' : 'SENT'} <ChevronDown className="w-3.5 h-3.5"/>
          </div>
        </div>

        {/* Rows Container */}
        <div className="divide-y divide-white/5 bg-[#0f0f0f]">
          {activeSubTab === 'USERS' ? (
            !loading && filteredUsers.length === 0 ? (
              <div className="p-24 text-center text-gray-600 uppercase font-black tracking-widest text-xs opacity-50">
                No users found.
              </div>
            ) : (
              filteredUsers.map(user => {
                const isSelected = selectedIds.has(user.id);
                return (
                  <div 
                    key={user.id} 
                    className={`grid grid-cols-[60px_1fr_400px_200px] gap-4 px-8 py-7 items-center transition-all group border-b border-white/5 last:border-0 ${isSelected ? 'bg-blue-500/[0.03]' : 'hover:bg-white/[0.01]'}`}
                  >
                    <div className="flex justify-center">
                      <div 
                        onClick={() => toggleSelect(user.id)}
                        className={`w-5 h-5 border-2 rounded-md cursor-pointer transition-all flex items-center justify-center ${isSelected ? 'bg-[#00adef] border-[#00adef]' : 'border-white/10 group-hover:border-white/30'}`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 text-black stroke-[4]" />}
                      </div>
                    </div>
                    
                    <div className="min-w-0 pr-4" onClick={() => toggleSelect(user.id)}>
                      <h4 className={`text-sm font-black uppercase tracking-wider truncate transition-colors ${isSelected ? 'text-[#00adef]' : 'text-white group-hover:text-[#00adef]'}`}>{user.name}</h4>
                      <p className="text-[11px] text-gray-600 font-bold mt-1 tracking-wide">{user.email}</p>
                    </div>

                    {/* Role Dropdown */}
                    <div className="relative">
                      <button 
                        onClick={(e) => { e.stopPropagation(); setOpenDropdownId(openDropdownId === user.id ? null : user.id); }}
                        className="w-full bg-[#181818] border border-white/5 rounded-xl px-5 py-3.5 flex justify-between items-center text-[12px] font-bold text-gray-300 hover:border-white/20 transition-all text-left group/btn shadow-inner"
                      >
                        <span className="truncate">{user.role}</span>
                        <ChevronDown className={`w-4 h-4 text-gray-600 transition-transform ${openDropdownId === user.id ? 'rotate-180' : ''}`} />
                      </button>

                      {openDropdownId === user.id && (
                        <>
                          <div className="fixed inset-0 z-[60]" onClick={() => setOpenDropdownId(null)}></div>
                          <div className="absolute top-full left-0 right-0 mt-2 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[70] py-2 animate-in slide-in-from-top-2 overflow-hidden backdrop-blur-md">
                            {ROLES.map(role => (
                              <button
                                key={role}
                                onClick={() => handleRoleChange(user.id, role)}
                                className="w-full text-left px-5 py-3 text-[11px] font-black uppercase tracking-widest hover:bg-white/5 flex items-center justify-between transition-colors group/item"
                              >
                                <span className={user.role === role ? 'text-[#00adef]' : 'text-gray-500 group-hover/item:text-white'}>
                                  {role}
                                </span>
                                {user.role === role && <Check className="w-4 h-4 text-[#00adef]" />}
                              </button>
                            ))}
                            <div className="border-t border-white/5 mt-2 pt-2">
                               <button
                                  onClick={() => { setDeleteConfirmId(user.id); setIsBulkDeleteMode(false); setOpenDropdownId(null); }}
                                  className="w-full text-left px-5 py-3 text-[11px] font-black uppercase tracking-widest text-red-500 hover:bg-red-500/10 transition-colors flex items-center gap-3"
                               >
                                  <Trash2 className="w-4 h-4" /> Remove User
                               </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Update Info */}
                    <div className="text-right">
                      <div className="text-[12px] font-black text-gray-400 tracking-tight uppercase">{user.updatedAt}</div>
                      <div className="text-[10px] font-bold text-gray-700 uppercase mt-1 tracking-widest">BY {user.updatedBy}</div>
                    </div>
                  </div>
                );
              })
            )
          ) : (
            // INVITES TAB
            !loading && invites.length === 0 ? (
              <div className="p-24 text-center text-gray-600 uppercase font-black tracking-widest text-xs opacity-50">
                No pending invites.
              </div>
            ) : (
              invites.map(invite => (
                <div key={invite.id} className="grid grid-cols-[60px_1fr_400px_200px] gap-4 px-8 py-7 items-center border-b border-white/5 last:border-0 hover:bg-white/[0.01]">
                   <div className="flex justify-center">
                    <div className="w-5 h-5 border-2 border-white/10 rounded-md"></div>
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-white uppercase tracking-wider">{invite.email}</h4>
                    <span className="text-[9px] bg-[#00adef]/10 text-[#00adef] px-2 py-0.5 rounded font-black tracking-widest uppercase mt-1 inline-block">PENDING</span>
                  </div>
                  <div className="text-gray-400 text-xs font-bold uppercase tracking-widest">{invite.role}</div>
                  <div className="text-right">
                    <div className="text-[12px] font-black text-gray-400 uppercase">{invite.sentAt}</div>
                    <button onClick={() => handleDeleteInvite(invite.id)} className="text-[10px] text-red-500 font-black uppercase tracking-widest mt-1 hover:underline">Revoke Invite</button>
                  </div>
                </div>
              ))
            )
          )}
        </div>

        {/* Custom Footer Pagination */}
        <div className="p-8 bg-[#0a0a0a] border-t border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4 rounded-b-2xl">
          <div className="flex gap-4">
            <button className="px-6 py-2.5 bg-white/5 text-gray-600 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 cursor-not-allowed hover:bg-white/10 hover:text-white transition-all">
              <ChevronLeft className="w-4 h-4" /> PREVIOUS
            </button>
            <button className="px-6 py-2.5 bg-white/5 text-gray-600 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 cursor-not-allowed hover:bg-white/10 hover:text-white transition-all">
              NEXT <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          
          <div className="text-[11px] font-black text-gray-700 uppercase tracking-[0.4em]">PAGE 1 OF 1</div>

          <div className="flex items-center gap-6">
             <div className="relative">
                <button className="bg-[#181818] border border-white/10 rounded-xl px-4 py-2 flex items-center gap-6 text-[11px] font-black text-gray-400 tracking-widest hover:border-white/20">
                  {itemsPerPage} <ChevronDown className="w-4 h-4 text-gray-600"/>
                </button>
             </div>
             <span className="text-[10px] font-black text-gray-700 uppercase tracking-[0.2em]">ITEMS PER PAGE</span>
          </div>
        </div>

        {/* Contextual Bulk Action Bar */}
        {selectedIds.size > 0 && (
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-[#00adef] text-black px-8 py-5 rounded-2xl shadow-[0_20px_50px_rgba(0,173,239,0.4)] flex items-center gap-10 animate-in slide-in-from-bottom-10 duration-500 z-50">
            <div className="flex items-center gap-4">
               <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center font-black text-white text-sm shadow-xl">
                 {selectedIds.size}
               </div>
               <span className="font-black uppercase tracking-[0.2em] text-[11px]">Operatives Marked</span>
            </div>
            
            <div className="h-6 w-px bg-black/20" />

            <div className="flex gap-4">
              <button 
                onClick={() => setSelectedIds(new Set())}
                className="px-6 py-2 hover:bg-black/5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors"
              >
                CLEAR
              </button>
              <button 
                onClick={() => { setIsBulkDeleteMode(true); setDeleteConfirmId('bulk'); }}
                className="px-6 py-2 bg-black text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all flex items-center gap-2 shadow-xl"
              >
                <Trash2 className="w-3.5 h-3.5" /> DELETE SELECTED
              </button>
            </div>
          </div>
        )}
      </div>

      {/* DELETE CONFIRMATION MODAL */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 bg-black/90 backdrop-blur-lg animate-in fade-in">
          <div className="bg-[#111111] border border-white/10 w-full max-w-sm rounded-[2rem] p-8 shadow-[0_30px_100px_rgba(0,0,0,1)] text-center">
            <div className="w-20 h-20 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mb-6 mx-auto border border-red-500/20">
              <AlertCircle className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-black text-white uppercase tracking-widest mb-3 leading-tight">
              {isBulkDeleteMode ? `Purge ${selectedIds.size} Users?` : 'Revoke Access?'}
            </h3>
            <p className="text-xs text-gray-500 uppercase tracking-widest leading-relaxed mb-10">
              {isBulkDeleteMode 
                ? `This will immediately remove all marked operatives from the system. This cannot be undone.`
                : `This will immediately remove ${users.find(u => u.id === deleteConfirmId)?.name} from the system. This cannot be undone.`
              }
            </p>
            <div className="flex gap-4">
              <button 
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl font-black uppercase tracking-[0.2em] text-[10px] transition-all"
              >
                CANCEL
              </button>
              <button 
                onClick={() => isBulkDeleteMode ? handleBulkDelete() : handleDeleteUser(deleteConfirmId)}
                className="flex-1 py-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black uppercase tracking-[0.2em] text-[10px] transition-all shadow-2xl shadow-red-600/20"
              >
                {isBulkDeleteMode ? 'CONFIRM PURGE' : 'DELETE USER'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INVITE MODAL */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl animate-in fade-in">
          <div className="bg-[#0f0f0f] border border-white/10 w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-[0_50px_150px_rgba(0,0,0,1)]">
            <div className="p-8 bg-[#0a0a0a] border-b border-white/5 flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-[#00adef]/10 rounded-2xl flex items-center justify-center border border-[#00adef]/20">
                  <UserPlus className="w-6 h-6 text-[#00adef]" />
                </div>
                <h3 className="text-xl font-black text-white uppercase tracking-widest">Invite Member</h3>
              </div>
              <button onClick={() => setIsInviteModalOpen(false)} className="p-3 hover:bg-white/5 rounded-full text-gray-600 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleInviteSubmit} className="p-10 space-y-8">
              <div>
                <label className="text-[10px] font-black text-gray-600 uppercase tracking-[0.3em] mb-3 block ml-1">Email Address</label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 group-focus-within:text-[#00adef] transition-colors" />
                  <input 
                    type="email" 
                    required
                    value={inviteForm.email}
                    onChange={e => setInviteForm({...inviteForm, email: e.target.value})}
                    className="w-full bg-[#181818] border border-white/10 rounded-xl p-4 pl-12 text-white font-bold outline-none focus:border-[#00adef] transition-all placeholder-gray-800"
                    placeholder="teammate@company.com"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-600 uppercase tracking-[0.3em] mb-3 block ml-1">Assign Initial Role</label>
                <div className="relative group">
                  <Shield className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 group-focus-within:text-[#00adef] transition-colors" />
                  <select 
                    value={inviteForm.role}
                    onChange={e => setInviteForm({...inviteForm, role: e.target.value})}
                    className="w-full bg-[#181818] border border-white/10 rounded-xl p-4 pl-12 text-white font-bold outline-none focus:border-[#00adef] transition-all uppercase appearance-none"
                  >
                    {ROLES.map(role => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 pointer-events-none" />
                </div>
              </div>

              <div className="bg-[#00adef]/5 border border-[#00adef]/20 p-5 rounded-2xl flex items-start gap-4">
                 <Clock className="w-5 h-5 text-[#00adef] shrink-0 mt-0.5" />
                 <p className="text-[10px] text-[#00adef]/80 font-bold leading-relaxed uppercase tracking-wider">
                    Invite links are valid for 7 days. Users will be prompted to set their profile details upon arrival.
                 </p>
              </div>

              <button 
                type="submit"
                className="w-full py-5 bg-[#00adef] hover:bg-[#0096ce] text-black font-black uppercase text-xs tracking-[0.25em] rounded-2xl transition-all shadow-2xl shadow-[#00adef]/20 flex items-center justify-center gap-4 active:scale-95"
              >
                SEND INVITATION
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountUsers;