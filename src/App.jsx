import React, { useState, useEffect, useCallback } from 'react';

import { createClient } from '@supabase/supabase-js';
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

import {
  Trophy,
  Users,
  ClipboardList,
  LogOut,
  Activity,
  Settings,
  Smartphone,
  UploadCloud,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  Plus,
  Calendar,
  Trash2,
  Key,
  Save,
  Radio,
  Clock,
  Loader2,
  Edit,
  ChevronDown,
  ChevronUp,
  Filter,
  Search,
  UserMinus,
  UserPlus,
  Medal,
  Printer,
  Palette,
  X,
  Menu,
  Building2,
  Shield,
  Moon,
  Sun,
  Timer,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

// ==========================================
// 1. CONSTANTS & GLOBALS
// ==========================================

// FIX: Single source of truth for the points system
const POINTS_MAP = [10, 8, 6, 4, 2, 1];
const RECORD_BONUS_POINTS = 2;

const TAILWIND_COLORS = [
  { label: 'Red',           class: 'bg-red-500'     },
  { label: 'Blue',          class: 'bg-blue-500'    },
  { label: 'Green',         class: 'bg-emerald-500' },
  { label: 'Yellow',        class: 'bg-amber-400'   },
  { label: 'Purple',        class: 'bg-purple-500'  },
  { label: 'Orange',        class: 'bg-orange-500'  },
  { label: 'Pink',          class: 'bg-pink-500'    },
  { label: 'Teal',          class: 'bg-teal-500'    },
  { label: 'Indigo',        class: 'bg-indigo-500'  },
  { label: 'Slate (Default)', class: 'bg-slate-400' },
];

// FIX: Tailwind class → real CSS hex value.
// Tailwind class strings like "bg-red-500" cannot be used as inline CSS values.
// This map lets us use getHouseColorHex() wherever an actual color value is needed.
const TAILWIND_TO_HEX = {
  'bg-red-500':     '#ef4444',
  'bg-blue-500':    '#3b82f6',
  'bg-emerald-500': '#10b981',
  'bg-amber-400':   '#fbbf24',
  'bg-purple-500':  '#a855f7',
  'bg-orange-500':  '#f97316',
  'bg-pink-500':    '#ec4899',
  'bg-teal-500':    '#14b8a6',
  'bg-indigo-500':  '#6366f1',
  'bg-slate-400':   '#94a3b8',
  'bg-cyan-500':    '#06b6d4',
  'bg-rose-500':    '#f43f5e',
  'bg-fuchsia-500': '#d946ef',
  'bg-violet-500':  '#8b5cf6',
  'bg-sky-500':     '#0ea5e9',
  'bg-lime-500':    '#84cc16',
};

const getHouseColorHex = (twClass) => TAILWIND_TO_HEX[twClass] || '#94a3b8';

const getHouseColor = (houseName, customMappings = {}) => {
  if (!houseName || houseName === 'Unassigned') return 'bg-slate-400';
  if (customMappings && customMappings[houseName]) return customMappings[houseName];
  const lower = houseName.toLowerCase();
  if (lower.includes('red'))    return 'bg-red-500';
  if (lower.includes('blue'))   return 'bg-blue-500';
  if (lower.includes('green'))  return 'bg-emerald-500';
  if (lower.includes('yellow')) return 'bg-amber-400';
  if (lower.includes('purple')) return 'bg-purple-500';
  let hash = 0;
  for (let i = 0; i < houseName.length; i++) {
    hash = houseName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const fallbacks = [
    'bg-pink-500','bg-indigo-500','bg-teal-500','bg-cyan-500',
    'bg-rose-500','bg-fuchsia-500','bg-violet-500','bg-sky-500',
    'bg-lime-500','bg-orange-500',
  ];
  return fallbacks[Math.abs(hash) % fallbacks.length];
};

// ==========================================
// 2. SHARED UTILITY FUNCTIONS
// ==========================================

// FIX: Extract shared standings calculation — was copy-pasted in two places.
// Mutates each result object with `calculated_points` as a side effect so the
// caller can use those values when building the recent-results feed.
const calculateStandings = (results, activities, houseColors) => {
  const housePoints = {};
  const resultsByActivity = {};

  results.forEach(r => {
    if (!resultsByActivity[r.event_activity_id]) resultsByActivity[r.event_activity_id] = [];
    resultsByActivity[r.event_activity_id].push(r);
  });

  Object.keys(resultsByActivity).forEach(actId => {
    const act = activities.find(a => a.id === actId);
    if (!act) return;
    const actResults = resultsByActivity[actId];

    if (act.activity_type === 'track') {
      actResults.sort((a, b) => parseFloat(a.result_value) - parseFloat(b.result_value));
    } else {
      actResults.sort((a, b) => parseFloat(b.result_value) - parseFloat(a.result_value));
    }

    actResults.forEach((res, index) => {
      const studentData = (Array.isArray(res.students) ? res.students[0] : res.students) || {};
      const house = studentData.house || 'Unassigned';
      let pts = index < POINTS_MAP.length ? POINTS_MAP[index] : 1;
      if (res.is_new_record) pts += RECORD_BONUS_POINTS;
      res.calculated_points = pts;
      if (house !== 'Unassigned') {
        if (!housePoints[house]) housePoints[house] = 0;
        housePoints[house] += pts;
      }
    });
  });

  return Object.keys(housePoints)
    .map(house => ({ name: house, points: housePoints[house], color: getHouseColor(house, houseColors) }))
    .sort((a, b) => b.points - a.points);
};

// Aggressive string normaliser for record matching
const normalizeString = (str) => {
  if (!str) return '';
  return str.toString().toLowerCase().replace(/[^a-z0-9]/g, '');
};

const parseCSVRow = (str, separator = ',') => {
  const result = [];
  let insideQuotes = false;
  let value = '';
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === '"' && (i === 0 || str[i - 1] !== '\\')) {
      insideQuotes = !insideQuotes;
    } else if (char === separator && !insideQuotes) {
      result.push(value.trim().replace(/^"|"$/g, ''));
      value = '';
    } else {
      value += char;
    }
  }
  result.push(value.trim().replace(/^"|"$/g, ''));
  return result;
};

const validateStudent = (row) => {
  const errors = [];
  if (!row.firstName || row.firstName.trim().length < 1) errors.push('First name is required');
  if (!row.lastName  || row.lastName.trim().length  < 1) errors.push('Last name is required');
  if (!row.ageGroup  || row.ageGroup.trim().length   < 2) errors.push('Age group required (e.g., U14)');
  if (!row.gender    || !['Boys','Girls','Mixed'].includes(row.gender))
    errors.push(`Gender could not be parsed. Found: ${row.gender}`);
  if (errors.length > 0) return { success: false, errors: errors.join(', ') };
  return {
    success: true,
    data: {
      ...row,
      class: row.class ? row.class.trim() : 'Unassigned',
      house: row.house ? row.house.trim() : 'Unassigned',
    },
  };
};

// ==========================================
// 3. SHARED UI COMPONENTS
// ==========================================

const Card = ({ children, className = '' }) => (
  <div className={`bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-6 ${className}`}>
    {children}
  </div>
);

const SortableHeader = ({ label, sortKey, sortConfig, onSort }) => (
  <th onClick={() => onSort(sortKey)} className="px-4 py-3 font-semibold cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors select-none group">
    <div className="flex items-center gap-1">{label}
      <div className="flex flex-col text-slate-300 group-hover:text-slate-500">
        <ChevronUp size={10} className={sortConfig?.key === sortKey && sortConfig?.direction === 'asc' ? 'text-sky-500' : ''}/>
        <ChevronDown size={10} className={sortConfig?.key === sortKey && sortConfig?.direction === 'desc' ? 'text-sky-500' : ''}/>
      </div>
    </div>
  </th>
);

const Button = ({ children, onClick, variant = 'primary', className = '', type = 'button', disabled = false, title = '' }) => {
  const base = 'px-4 py-2.5 rounded-xl font-semibold transition-all duration-150 flex items-center justify-center gap-2 w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed text-sm';
  const variants = {
    primary:   'bg-sky-500 hover:bg-sky-600 active:bg-sky-700 text-white shadow-sm hover:shadow-md',
    secondary: 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-200',
    danger:    'bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 dark:bg-red-900/30 dark:hover:bg-red-900/50 dark:text-red-400 dark:border-red-800',
    success:   'bg-sky-500 hover:bg-sky-600 active:bg-sky-700 text-white shadow-sm hover:shadow-md',
    outline:   'border border-slate-200 hover:border-sky-300 hover:text-sky-600 text-slate-600 bg-white dark:bg-slate-800 dark:border-slate-600 dark:text-slate-300 dark:hover:border-sky-500 dark:hover:text-sky-400',
    ghost:     'text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-700',
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} title={title}
      className={`${base} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
};

const Badge = ({ children, color = 'slate' }) => {
  const colors = {
    slate:   'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
    blue:    'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
    sky:     'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
    emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    amber:   'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    red:     'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300',
    purple:  'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${colors[color] || colors.slate}`}>
      {children}
    </span>
  );
};

const StatCard = ({ icon: Icon, label, value, color = 'sky' }) => {
  const colors = {
    sky:     'bg-sky-50 text-sky-500 dark:bg-sky-900/30 dark:text-sky-400',
    amber:   'bg-amber-50 text-amber-500 dark:bg-amber-900/30 dark:text-amber-400',
    emerald: 'bg-emerald-50 text-emerald-500 dark:bg-emerald-900/30 dark:text-emerald-400',
    purple:  'bg-purple-50 text-purple-500 dark:bg-purple-900/30 dark:text-purple-400',
    blue:    'bg-sky-50 text-sky-500 dark:bg-sky-900/30 dark:text-sky-400',
  };
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm">
      <div className={`inline-flex p-2.5 rounded-xl mb-3 ${colors[color] || colors.sky}`}><Icon size={20}/></div>
      <p className="text-3xl font-black text-slate-800 dark:text-white">{value}</p>
      <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-0.5">{label}</p>
    </div>
  );
};

const PageHeader = ({ title, subtitle, onBack, actions }) => (
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-5 border-b border-slate-100 dark:border-slate-700">
    <div className="flex items-center gap-3">
      {onBack && (
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors">
          <ArrowLeft size={20}/>
        </button>
      )}
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">{title}</h2>
        {subtitle && <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
    {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
  </div>
);

// --- FLAGS MODULE (organiser command centre) ---
const FlagsModule = ({ user, showToast, onCountChange }) => {
  const [flags, setFlags]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState('open');

  const fetchFlags = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('event_flags')
      .select(`
        id, flag_type, message, status, created_at,
        event_activities ( name, age_group, gender ),
        users ( first_name, last_name )
      `)
      .eq('school_id', user.school_id)
      .order('created_at', { ascending: false });
    setLoading(false);
    if (error) { showToast('Failed to load flags', 'error'); return; }
    const rows = data || [];
    setFlags(rows);
    if (onCountChange) onCountChange(rows.filter(f => f.status === 'open').length);
  }, [user.school_id, showToast, onCountChange]);

  useEffect(() => { fetchFlags(); }, [fetchFlags]);

  const handleResolve = async (id) => {
    const { error } = await supabase.from('event_flags').update({ status: 'resolved' }).eq('id', id);
    if (error) { showToast('Failed to resolve flag', 'error'); return; }
    showToast('Flag marked as resolved');
    setFlags(prev => {
      const next = prev.map(f => f.id === id ? { ...f, status: 'resolved' } : f);
      if (onCountChange) onCountChange(next.filter(f => f.status === 'open').length);
      return next;
    });
  };

  const handleReopen = async (id) => {
    const { error } = await supabase.from('event_flags').update({ status: 'open' }).eq('id', id);
    if (error) { showToast('Failed to reopen flag', 'error'); return; }
    showToast('Flag reopened');
    setFlags(prev => {
      const next = prev.map(f => f.id === id ? { ...f, status: 'open' } : f);
      if (onCountChange) onCountChange(next.filter(f => f.status === 'open').length);
      return next;
    });
  };

  const visible = flags.filter(f => f.status === tab);
  const openCount = flags.filter(f => f.status === 'open').length;

  const typeColor = { injury: 'red', equipment: 'amber', delay: 'blue', issue: 'slate' };
  const typeBg    = { injury: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
                      equipment: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
                      delay: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
                      issue: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300' };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Staff Flags</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Issues reported by staff during the event.</p>
        </div>
        <button onClick={fetchFlags} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
          <Loader2 size={18} className={loading ? 'animate-spin' : ''}/>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
        <button onClick={() => setTab('open')}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 ${tab === 'open' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
          Open
          {openCount > 0 && <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full leading-none">{openCount}</span>}
        </button>
        <button onClick={() => setTab('resolved')}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${tab === 'resolved' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
          Resolved
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-slate-300" size={32}/></div>
      ) : visible.length === 0 ? (
        <Card className="text-center py-14">
          <CheckCircle2 size={40} className="mx-auto text-slate-200 dark:text-slate-600 mb-3"/>
          <p className="font-semibold text-slate-500 dark:text-slate-400">
            {tab === 'open' ? 'No open flags — all clear!' : 'No resolved flags yet.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {visible.map(flag => (
            <div key={flag.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full capitalize ${typeBg[flag.flag_type] || typeBg.issue}`}>
                    {flag.flag_type}
                  </span>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {flag.event_activities?.name} · {flag.event_activities?.age_group} {flag.event_activities?.gender}
                  </span>
                </div>
                <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed">{flag.message}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                  Reported by {flag.users?.first_name} {flag.users?.last_name} · {new Date(flag.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <div className="flex-shrink-0">
                {flag.status === 'open' ? (
                  <button onClick={() => handleResolve(flag.id)}
                    className="px-3 py-1.5 text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-lg hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors whitespace-nowrap">
                    Mark Resolved
                  </button>
                ) : (
                  <button onClick={() => handleReopen(flag.id)}
                    className="px-3 py-1.5 text-xs font-semibold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors whitespace-nowrap">
                    Reopen
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const ChangePasswordModal = ({ onClose, showToast }) => {
  const [newPw, setNewPw]       = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [saving, setSaving]     = useState(false);

  const handleSave = async () => {
    if (newPw.length < 6) { showToast('Password must be at least 6 characters', 'error'); return; }
    if (newPw !== confirmPw) { showToast('Passwords do not match', 'error'); return; }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setSaving(false);
    if (error) { showToast(error.message || 'Failed to update password', 'error'); return; }
    showToast('Password updated successfully');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-sm w-full border border-slate-200 dark:border-slate-700">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-sky-100 dark:bg-sky-900/30 rounded-xl"><Key size={18} className="text-sky-600 dark:text-sky-400"/></div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Change Password</h3>
            </div>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X size={18}/></button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">New Password</label>
              <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Min. 6 characters"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-sky-500 text-sm"/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Confirm Password</label>
              <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="Repeat new password"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-sky-500 text-sm"/>
            </div>
          </div>
        </div>
        <div className="px-6 pb-6 flex gap-3 justify-end">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save Password'}</Button>
        </div>
      </div>
    </div>
  );
};

const ConfirmModal = ({ isOpen, title, message, confirmText = 'Confirm', onConfirm, onCancel }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 dark:border-slate-700">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-xl"><AlertCircle size={20} className="text-red-600 dark:text-red-400"/></div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h3>
          </div>
          <p className="text-slate-500 dark:text-slate-400 leading-relaxed whitespace-pre-wrap text-sm">{message}</p>
        </div>
        <div className="px-6 pb-6 flex gap-3 justify-end">
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button variant="danger" onClick={onConfirm}>{confirmText}</Button>
        </div>
      </div>
    </div>
  );
};

const Toast = ({ toast }) => {
  if (!toast) return null;
  return (
    <div className="fixed bottom-6 right-6 z-50 hide-on-print">
      <div className={`flex items-center gap-3 px-5 py-4 rounded-2xl shadow-xl text-white font-semibold text-sm ${toast.type === 'error' ? 'bg-red-600' : 'bg-sky-600'}`}>
        {toast.type === 'error' ? <AlertCircle size={18}/> : <CheckCircle2 size={18}/>}
        {toast.msg}
      </div>
    </div>
  );
};

// ==========================================
// 4. DATA IMPORT MODULE
// ==========================================

const DataImportModule = ({ onBack, user, showToast }) => {
  const [isDragging, setIsDragging]           = useState(false);
  const [parsedData, setParsedData]           = useState([]);
  const [validationErrors, setValidationErrors] = useState([]);
  const [fileName, setFileName]               = useState('');
  const [isSaving, setIsSaving]               = useState(false);
  const [modalConfig, setModalConfig]         = useState({ isOpen: false });

  const processFile = (file) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text  = e.target.result;
      const lines = text.split(/\r\n|\n/).filter(l => l.trim() !== '');
      if (lines.length < 2) { showToast('File appears empty.', 'error'); return; }

      const sep = lines[0].includes(';') ? ';' : lines[0].includes('\t') ? '\t' : ',';
      const rawHeaders = parseCSVRow(lines[0], sep);
      const mappedHeaders = rawHeaders.map(h => {
        const n = h.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
        if (['firstname','first','name','givenname'].includes(n))         return 'firstName';
        if (['lastname','last','surname','familyname'].includes(n))       return 'lastName';
        if (['agegroup','age','group','division','u'].includes(n))        return 'ageGroup';
        if (['class','grade','form','room','homeroom'].includes(n))       return 'class';
        if (['house','team','color','colour'].includes(n))                return 'house';
        if (['gender','sex','mf','boygirl'].includes(n))                  return 'gender';
        return h;
      });

      if (!mappedHeaders.includes('gender')) {
        showToast(`CRITICAL: Missing 'Gender' column. Found: ${rawHeaders.join(', ')}`, 'error');
        setFileName('');
        return;
      }

      const validRows = [], invalidRows = [];
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVRow(lines[i], sep);
        const rowObj = {};
        mappedHeaders.forEach((h, idx) => { rowObj[h] = values[idx] || ''; });

        let age = (rowObj.ageGroup || '').toString().trim().toUpperCase().replace(/[\s/\\-]/g, '');
        if (/^\d+$/.test(age)) age = `U${age}`;
        rowObj.ageGroup = age;

        if (rowObj.gender) {
          const g = rowObj.gender.trim().toLowerCase();
          if (['boy','boys','m','male'].includes(g))     rowObj.gender = 'Boys';
          else if (['girl','girls','f','female'].includes(g)) rowObj.gender = 'Girls';
          else rowObj.gender = 'Mixed';
        }

        const v = validateStudent(rowObj);
        if (v.success) validRows.push(v.data);
        else           invalidRows.push({ rowNumber: i + 1, errors: v.errors });
      }
      setParsedData(validRows);
      setValidationErrors(invalidRows);
    };
    reader.onerror = () => showToast('Failed to read the file. Please ensure it is a valid CSV.', 'error');
    reader.readAsText(file);
  };

  const handleDrop = (e) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.type === 'text/csv' || file.name.endsWith('.csv'))) processFile(file);
    else showToast('Please upload a valid .csv file', 'error');
  };

  const [popiaConsent, setPopiaConsent] = useState(false);

  const handleSaveToDatabase = async () => {
    if (!popiaConsent) { showToast('Please confirm POPIA consent before uploading.', 'error'); return; }
    setIsSaving(true);
    try {
      if (!user?.school_id) throw new Error('Critical Error: No school_id found.');
      const formatted = parsedData.map(s => ({
        school_id:  user.school_id,
        first_name: s.firstName,
        last_name:  s.lastName,
        age_group:  s.ageGroup,
        class:      s.class,
        house:      s.house || 'Unassigned',
        gender:     s.gender,
      }));
      const { error } = await supabase.from('students').upsert(formatted, {
        onConflict:       'school_id,first_name,last_name,class,gender',
        ignoreDuplicates: true,
      });
      if (error) throw error;
      showToast(`Upload complete! ${parsedData.length} records processed.`);
      onBack();
    } catch (err) {
      showToast(err.message || 'Failed to save data.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <ConfirmModal
        isOpen={modalConfig.isOpen} title="Reset Data"
        message="Are you sure you want to clear this file and upload a new one?"
        onConfirm={() => { setFileName(''); setParsedData([]); setValidationErrors([]); setModalConfig({ isOpen: false }); }}
        onCancel={() => setModalConfig({ isOpen: false })}
      />
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div className="flex items-center gap-4">
          <Button onClick={onBack} variant="secondary" className="!px-3 !py-2"><ArrowLeft size={18}/></Button>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Import Class Lists</h2>
            <p className="text-sm text-slate-500">Upload a CSV file containing student data.</p>
          </div>
        </div>
        <button
          onClick={() => {
            const csv = 'First Name,Last Name,Age Group,Gender,House,Class\nJane,Smith,U12,Girls,Eagles,6A\nJohn,Doe,U13,Boys,Lions,7B';
            const blob = new Blob([csv], { type: 'text/csv' });
            const url  = URL.createObjectURL(blob);
            const a    = document.createElement('a');
            a.href = url; a.download = 'student_import_template.csv'; a.click();
            URL.revokeObjectURL(url);
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:border-sky-300 hover:text-sky-600 transition-colors">
          <FileSpreadsheet size={16}/> Download Template
        </button>
      </div>

      {!fileName && (
        <Card>
          <div
            className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${isDragging ? 'border-sky-400 bg-sky-50' : 'border-slate-300 bg-slate-50 hover:bg-slate-100'}`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <UploadCloud size={48} className="mx-auto text-slate-400 mb-4"/>
            <h3 className="text-lg font-semibold text-slate-700 mb-2">Drag and drop your CSV here</h3>
            <p className="text-slate-500 text-sm mb-4">Required columns: First Name, Last Name, Age Group, <strong>Gender</strong></p>
            <p className="text-xs text-slate-400 mb-6">Not sure of the format? <button onClick={() => {
              const csv = 'First Name,Last Name,Age Group,Gender,House,Class\nJane,Smith,U12,Girls,Eagles,6A\nJohn,Doe,U13,Boys,Lions,7B';
              const blob = new Blob([csv], { type: 'text/csv' });
              const url  = URL.createObjectURL(blob);
              const a    = document.createElement('a');
              a.href = url; a.download = 'student_import_template.csv'; a.click();
              URL.revokeObjectURL(url);
            }} className="text-sky-600 underline font-medium">Download the template</button></p>
            <Button onClick={() => document.getElementById('file-upload').click()} variant="primary">
              <FileSpreadsheet size={18}/> Browse Files
            </Button>
            <input id="file-upload" type="file" accept=".csv" className="hidden"
              onChange={(e) => { if (e.target.files[0]) processFile(e.target.files[0]); }} />
          </div>
        </Card>
      )}

      {fileName && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-l-4 border-l-emerald-500">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="text-emerald-500 mt-1" size={20}/>
                <div><p className="font-semibold text-slate-900">Valid Records</p><p className="text-2xl font-bold text-emerald-600">{parsedData.length}</p></div>
              </div>
            </Card>
            <Card className={`border-l-4 ${validationErrors.length > 0 ? 'border-l-red-500' : 'border-l-slate-200'}`}>
              <div className="flex items-start gap-3">
                <AlertCircle className={`${validationErrors.length > 0 ? 'text-red-500' : 'text-slate-400'} mt-1`} size={20}/>
                <div><p className="font-semibold text-slate-900">Invalid Records</p><p className={`text-2xl font-bold ${validationErrors.length > 0 ? 'text-red-600' : 'text-slate-400'}`}>{validationErrors.length}</p></div>
              </div>
            </Card>
          </div>

          {validationErrors.length > 0 && (
            <Card className="bg-red-50 border-red-200">
              <h3 className="text-red-800 font-semibold mb-2 flex items-center gap-2"><AlertCircle size={18}/> Fix these errors in your CSV and re-upload:</h3>
              <ul className="text-sm text-red-600 max-h-40 overflow-y-auto space-y-1">
                {validationErrors.map((err, i) => <li key={i}><strong>Row {err.rowNumber}:</strong> {err.errors}</li>)}
              </ul>
              <Button onClick={() => setModalConfig({ isOpen: true })} variant="danger" className="mt-4 w-full">Reset &amp; Upload New File</Button>
            </Card>
          )}

          {parsedData.length > 0 && validationErrors.length === 0 && (
            <Card>
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-slate-900">Data Preview (first 5 rows)</h3>
                <Button onClick={handleSaveToDatabase} variant="success" disabled={isSaving || !popiaConsent}>
                  {isSaving ? <><Loader2 className="animate-spin" size={18}/> Saving...</> : 'Save to Database'}
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-100 text-slate-600">
                    <tr><th className="px-4 py-3">First Name</th><th className="px-4 py-3">Last Name</th><th className="px-4 py-3">Gender</th><th className="px-4 py-3">Class</th><th className="px-4 py-3">Age Group</th><th className="px-4 py-3">House</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsedData.slice(0, 5).map((s, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium">{s.firstName}</td>
                        <td className="px-4 py-3">{s.lastName}</td>
                        <td className="px-4 py-3">{s.gender}</td>
                        <td className="px-4 py-3">{s.class}</td>
                        <td className="px-4 py-3">{s.ageGroup}</td>
                        <td className="px-4 py-3">{s.house}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className={`mt-4 p-4 rounded-lg border-2 ${popiaConsent ? 'border-emerald-400 bg-emerald-50' : 'border-amber-300 bg-amber-50'}`}>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={popiaConsent} onChange={e => setPopiaConsent(e.target.checked)} className="mt-1 w-4 h-4 rounded accent-emerald-600 cursor-pointer flex-shrink-0"/>
                  <span className="text-sm text-slate-700 leading-relaxed">
                    <strong className="text-slate-900">POPIA Compliance Confirmation</strong> — I confirm that the school has obtained the necessary consent from parents/guardians to collect and process the personal information of the learners listed in this file, in accordance with the <strong>Protection of Personal Information Act (POPIA), 2013</strong>. This data will be used solely for the purpose of managing sports day events and will not be shared with third parties without consent.
                  </span>
                </label>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

// ==========================================
// 5. HOUSE SETTINGS MODULE
// ==========================================

const HouseSetupModule = ({ onBack, user, showToast }) => {
  const [houses, setHouses]     = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving]   = useState(false);

  useEffect(() => {
    const fetchHouses = async () => {
      setIsLoading(true);
      try {
        const { data: students } = await supabase.from('students').select('house').eq('school_id', user.school_id);
        const uniqueNames = [...new Set((students || []).map(s => s.house || 'Unassigned'))].filter(h => h !== 'Unassigned');
        const { data: saved }   = await supabase.from('school_houses').select('*').eq('school_id', user.school_id);
        setHouses(uniqueNames.map(name => {
          const s = (saved || []).find(h => h.house_name === name);
          return { name, color: s ? s.house_color : 'bg-slate-400' };
        }));
      } catch (e) { showToast('Failed to load houses', 'error'); } finally { setIsLoading(false); }
    };
    fetchHouses();
  }, [user]);

  const handleColorChange = (name, color) => setHouses(prev => prev.map(h => h.name === name ? { ...h, color } : h));

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = houses.map(h => ({ school_id: user.school_id, house_name: h.name, house_color: h.color }));
      const { error } = await supabase.from('school_houses').upsert(payload, { onConflict: 'school_id, house_name' });
      if (error) throw error;
      showToast('House colors successfully saved!');
      onBack();
    } catch (e) { showToast('Failed to save house colors. Check database schema.', 'error'); } finally { setIsSaving(false); }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-4">
        <div className="flex items-center gap-4">
          <Button onClick={onBack} variant="secondary" className="!px-3 !py-2"><ArrowLeft size={18}/></Button>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Manage Houses</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Assign school colours to each house.</p>
          </div>
        </div>
        <Button onClick={handleSave} variant="primary" disabled={isSaving || isLoading}>
          {isSaving ? <><Loader2 className="animate-spin" size={18}/> Saving...</> : <><Save size={18}/> Save Colors</>}
        </Button>
      </div>
      <Card>
        {isLoading ? (
          <div className="text-center py-12"><Loader2 className="animate-spin mx-auto text-slate-400" size={32}/></div>
        ) : houses.length === 0 ? (
          <div className="text-center py-12 text-slate-500">No houses found. Please import students first.</div>
        ) : (
          <div className="space-y-4">
            {houses.map((house, idx) => (
              <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full shadow-sm ${house.color}`}></div>
                  <span className="font-bold text-slate-900 dark:text-white text-lg">{house.name}</span>
                </div>
                <select value={house.color} onChange={(e) => handleColorChange(house.name, e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-sky-400 font-medium">
                  {TAILWIND_COLORS.map(c => <option key={c.class} value={c.class}>{c.label}</option>)}
                </select>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

// ==========================================
// 6. EVENT SETUP MODULE
// ==========================================

const EventSetupModule = ({ onBack, user, showToast }) => {
  const [events, setEvents]               = useState([]);
  const [schoolRecords, setSchoolRecords] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('new');
  const [isLoading, setIsLoading]         = useState(true);

  const [eventName, setEventName]     = useState('');
  const [eventDate, setEventDate]     = useState('');
  const [eventIsActive, setEventIsActive] = useState(true);
  const [parentCode, setParentCode]   = useState('');
  const [activities, setActivities]   = useState([]);

  const [schoolGenderType, setSchoolGenderType] = useState('Co-ed');
  const [presetParticipants, setPresetParticipants] = useState(2);
  const [newActivity, setNewActivity] = useState({ name: '', type: 'track', scoringType: 'metric', ageGroup: 'U14', gender: 'Boys', participantsPerHouse: 2, recordValue: '', recordHolder: '' });
  const [isSaving, setIsSaving]   = useState(false);
  const [modalConfig, setModalConfig] = useState({ isOpen: false, item: null, type: null, payload: null });

  useEffect(() => {
    const fetchAll = async () => {
      setIsLoading(true);
      try {
        const { data: eData } = await supabase.from('events').select('*').eq('school_id', user.school_id).order('created_at', { ascending: false });
        setEvents(eData || []);
        const { data: rData } = await supabase.from('event_records').select('*').eq('school_id', user.school_id);
        setSchoolRecords(rData || []);
        setParentCode(Math.random().toString(36).substring(2, 10).toUpperCase());
      } catch (err) { console.error('Error fetching data:', err); } finally { setIsLoading(false); }
    };
    fetchAll();
  }, [user]);

  const handleEventSelect = async (eventId) => {
    setSelectedEventId(eventId);
    if (eventId === 'new') {
      setEventName(''); setEventDate(''); setActivities([]);
      setParentCode(Math.random().toString(36).substring(2, 10).toUpperCase());
      return;
    }
    const evt = events.find(e => e.id === eventId);
    if (!evt) return;
    setEventName(evt.name); setEventDate(evt.event_date); setParentCode(evt.parent_access_code); setEventIsActive(evt.is_active ?? true);
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from('event_activities').select('*').eq('event_id', eventId);
      if (error) throw error;
      setActivities((data || []).map(a => {
        const rec = schoolRecords.find(r =>
          normalizeString(r.activity_name) === normalizeString(a.name) &&
          normalizeString(r.age_group)     === normalizeString(a.age_group) &&
          normalizeString(r.gender)        === normalizeString(a.gender)
        );
        return { id: a.id, name: a.name, type: a.activity_type, scoringType: a.scoring_type || 'metric', ageGroup: a.age_group, gender: a.gender, participantsPerHouse: a.participants_per_house || 2, recordValue: rec ? rec.record_value : '', recordHolder: rec ? rec.record_holder : '' };
      }));
    } catch (err) { console.error('Error fetching activities', err); } finally { setIsLoading(false); }
  };

  // FIX: Use a counter as part of the temp ID to avoid Date.now() collisions
  // inside a synchronous loop where all iterations share the same millisecond.
  const applyPreset = (type) => setModalConfig({ isOpen: true, type: 'preset', payload: type });

  const executePreset = () => {
    const type   = modalConfig.payload;
    const ages   = type === 'Primary' ? ['U10','U11','U12','U13','U14 (Open)'] : ['U14','U15','U16','U17','U18','Open'];
    const genders = schoolGenderType === 'Co-ed' ? ['Boys','Girls'] : [schoolGenderType === 'Boys Only' ? 'Boys' : 'Girls'];
    const newActs = [];
    let counter = 0;
    ages.forEach(age => {
      genders.forEach(gender => {
        const acts = [
          { name: 'High Jump', type: 'field' }, { name: 'Long Jump', type: 'field' },
          { name: 'Shotput', type: 'field' },   { name: '100m', type: 'track' },
          { name: 'Relays', type: 'track' },
        ];
        acts.forEach(act => {
          newActs.push({ id: `temp-${counter++}`, name: act.name, type: act.type, scoringType: 'metric', ageGroup: age, gender, participantsPerHouse: presetParticipants, recordValue: '', recordHolder: '' });
        });
        const distName = (age.includes('Open') || age === 'U18' || age === 'U19') ? '1500m' : '1200m';
        newActs.push({ id: `temp-${counter++}`, name: distName, type: 'long_distance', ageGroup: age, gender, participantsPerHouse: presetParticipants, recordValue: '', recordHolder: '' });
      });
    });
    setActivities(prev => [...prev, ...newActs]);
    setModalConfig({ isOpen: false, item: null, type: null, payload: null });
  };

  const handleAddActivity = (e) => {
    e.preventDefault();
    if (!newActivity.name.trim()) return;
    const isDup = activities.some(a => a.name.toLowerCase() === newActivity.name.toLowerCase() && a.ageGroup === newActivity.ageGroup && a.gender === newActivity.gender);
    if (isDup) { showToast('This exact activity already exists for this age group and gender.', 'error'); return; }
    setActivities(prev => [...prev, { ...newActivity, id: `temp-${Date.now()}` }]);
    setNewActivity(prev => ({ ...prev, name: '', recordValue: '', recordHolder: '' }));
  };

  const handleUpdateActivityProp = (id, key, val) => setActivities(prev => prev.map(act => act.id === id ? { ...act, [key]: val } : act));

  const handleRecordKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const inputs = Array.from(document.querySelectorAll('.record-input'));
      const index  = inputs.indexOf(e.target);
      if (index > -1 && index < inputs.length - 1) inputs[index + 1].focus(); else e.target.blur();
    }
  };

  const executeAction = async () => {
    const { item, type } = modalConfig;
    if (type === 'preset') return executePreset();
    if (type === 'activity') {
      if (!item.startsWith('temp-')) { try { await supabase.from('event_activities').delete().eq('id', item); } catch (e) {} }
      setActivities(activities.filter(a => a.id !== item));
    } else if (type === 'event') {
      setIsSaving(true);
      try {
        await supabase.from('events').delete().eq('id', item);
        handleEventSelect('new');
        showToast('Event deleted successfully.');
      } catch (e) { showToast('Failed to delete event.', 'error'); } finally { setIsSaving(false); }
    }
    setModalConfig({ isOpen: false, item: null, type: null, payload: null });
  };

  const handleSaveEvent = async () => {
    if (!eventName || !eventDate) { showToast('Please provide an event name and date.', 'error'); return; }
    setIsSaving(true);
    try {
      let targetEventId = selectedEventId;
      if (selectedEventId === 'new') {
        const { data: evtData, error: evtErr } = await supabase.from('events').insert({ school_id: user.school_id, name: eventName, event_date: eventDate, parent_access_code: parentCode, is_active: eventIsActive }).select().single();
        if (evtErr) throw evtErr;
        targetEventId = evtData.id;
      } else {
        const { error: evtErr } = await supabase.from('events').update({ name: eventName, event_date: eventDate, is_active: eventIsActive }).eq('id', selectedEventId);
        if (evtErr) throw evtErr;
      }

      const toInsert = activities.filter(a => a.id.startsWith('temp-')).map(a => ({ event_id: targetEventId, name: a.name.trim(), activity_type: a.type, scoring_type: a.scoringType || 'metric', age_group: a.ageGroup, gender: a.gender, participants_per_house: a.participantsPerHouse }));
      const toUpdate = activities.filter(a => !a.id.startsWith('temp-')).map(a => ({ id: a.id, event_id: targetEventId, name: a.name.trim(), activity_type: a.type, scoring_type: a.scoringType || 'metric', age_group: a.ageGroup, gender: a.gender, participants_per_house: a.participantsPerHouse }));

      if (toInsert.length > 0) await supabase.from('event_activities').insert(toInsert);
      if (toUpdate.length > 0) {
        const { error: updErr } = await supabase.from('event_activities').upsert(toUpdate, { onConflict: 'id' });
        if (updErr) throw updErr;
      }

      const recordsToInsert = activities.filter(a => a.recordValue && a.recordHolder).map(a => ({
        school_id: user.school_id, activity_name: a.name.trim(),
        age_group: a.ageGroup.replace(/[\s/\\-]/g, ''), gender: a.gender,
        record_value: parseFloat(a.recordValue), record_holder: a.recordHolder,
      }));
      if (recordsToInsert.length > 0) {
        await supabase.from('event_records').upsert(recordsToInsert, { onConflict: 'school_id, activity_name, age_group, gender' });
      }

      showToast('Event saved successfully!');
      onBack();
    } catch (err) { showToast('Failed to save the event. ' + (err.message || ''), 'error'); } finally { setIsSaving(false); }
  };

  return (
    <div className="space-y-6 relative">
      <ConfirmModal
        isOpen={modalConfig.isOpen}
        title={modalConfig.type === 'event' ? 'Delete Event' : modalConfig.type === 'preset' ? 'Apply Preset' : 'Delete Activity'}
        message={modalConfig.type === 'event' ? `Delete "${eventName}"? This will permanently erase ALL activities and results recorded for this event. This cannot be undone.` : modalConfig.type === 'preset' ? `This will auto-generate standard ${modalConfig.payload} School events based on your gender settings.\n\nContinue?` : 'Are you sure? This will delete this activity and any results recorded for it.'}
        onConfirm={executeAction} onCancel={() => setModalConfig({ isOpen: false, item: null, type: null, payload: null })}
      />

      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div className="flex items-center gap-4">
          <Button onClick={onBack} variant="secondary" className="!px-3 !py-2"><ArrowLeft size={18}/></Button>
          <div><h2 className="text-xl font-bold text-slate-900">Event Manager</h2><p className="text-sm text-slate-500">Create new events or edit existing ones.</p></div>
        </div>
        <div className="flex gap-2">
          {selectedEventId !== 'new' && <Button onClick={() => setModalConfig({ isOpen: true, item: selectedEventId, type: 'event' })} variant="danger" disabled={isSaving}><Trash2 size={18}/></Button>}
          <Button onClick={handleSaveEvent} variant="success" disabled={isSaving}>
            {isSaving ? <><Loader2 className="animate-spin" size={18}/> Saving...</> : selectedEventId === 'new' ? 'Create Event' : 'Update Event'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-6 lg:col-span-1">
          <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
            <label className="block text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">Select Action</label>
            <div className="relative">
              <select value={selectedEventId} onChange={(e) => handleEventSelect(e.target.value)}
                className="w-full px-3 py-2 border border-blue-300 dark:border-blue-700 rounded-lg outline-none bg-white dark:bg-slate-700 dark:text-white appearance-none pr-8 font-medium text-slate-700">
                <option value="new">✨ Create New Event...</option>
                {events.length > 0 && <optgroup label="Existing Events">{events.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</optgroup>}
              </select>
              <ChevronDown className="absolute right-2 top-2.5 text-blue-500 pointer-events-none" size={18}/>
            </div>
          </Card>

          <Card>
            <h3 className="font-semibold text-slate-900 dark:text-white border-b dark:border-slate-700 pb-2 mb-4 flex items-center gap-2"><Calendar size={18}/> Event Details</h3>
            <div className="space-y-4">
              <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Event Name</label><input type="text" value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder="e.g., Annual Inter-House Athletics" className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-sky-400 outline-none bg-white dark:bg-slate-700 dark:text-white"/></div>
              <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Date</label><input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-sky-400 outline-none bg-white dark:bg-slate-700 dark:text-white"/></div>
              <div className={`flex items-center justify-between p-3 rounded-lg border-2 ${eventIsActive ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-700' : 'border-slate-300 bg-slate-50 dark:border-slate-600 dark:bg-slate-700/30'}`}>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{eventIsActive ? '🟢 Event is Live' : '🔴 Event is Archived'}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{eventIsActive ? 'Parent portal is open — parents can view live results.' : 'Parent portal is closed. Results are locked.'}</p>
                </div>
                <button type="button" onClick={() => setEventIsActive(p => !p)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${eventIsActive ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${eventIsActive ? 'translate-x-6' : 'translate-x-1'}`}/>
                </button>
              </div>
            </div>
          </Card>

          <Card className="bg-sky-50 dark:bg-sky-900/20 border-sky-200 dark:border-sky-800">
            <h3 className="font-semibold text-sky-900 dark:text-sky-300 border-b border-sky-200 dark:border-sky-800 pb-2 mb-4 flex items-center gap-2"><Key size={18}/> Parent Access Code</h3>
            <p className="text-sm text-sky-700 dark:text-sky-400 mb-3">Share this code with parents to view the live leaderboard.</p>
            <div className="bg-white dark:bg-slate-800 px-4 py-3 rounded-lg border border-sky-200 dark:border-sky-700 text-center text-2xl font-mono font-bold tracking-widest text-slate-800 dark:text-white mb-3">{parentCode}</div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => { navigator.clipboard.writeText(parentCode); showToast('Code copied!'); }}
                className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-sky-200 dark:border-sky-700 text-sky-700 dark:text-sky-400 text-sm font-semibold hover:bg-sky-50 dark:hover:bg-sky-900/30 transition-colors">
                <Save size={14}/> Copy Code
              </button>
              <button
                onClick={() => {
                  const msg = `🏆 SportsDay Live!\n\nJoin us today using access code: *${parentCode}*\n\nOpen the parent portal at: ${window.location.origin}/?portal=parent`;
                  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
                }}
                className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-green-500 hover:bg-green-600 text-white text-sm font-semibold transition-colors">
                <Smartphone size={14}/> WhatsApp
              </button>
            </div>
            {selectedEventId === 'new' && (
              <button onClick={() => setParentCode(Math.random().toString(36).substring(2, 10).toUpperCase())}
                className="w-full mt-2 text-xs text-sky-600 dark:text-sky-400 hover:underline text-center">
                Regenerate code
              </button>
            )}
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Card className="!p-4">
            <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between border-b pb-3 mb-4 gap-4">
              <h3 className="font-semibold text-slate-900 flex items-center gap-2"><Activity size={18}/> Activity Builder</h3>
              <div className="flex flex-wrap items-center gap-2 bg-slate-50 dark:bg-slate-700/50 p-2 rounded-lg border border-slate-200 dark:border-slate-600">
                <select value={schoolGenderType} onChange={e => setSchoolGenderType(e.target.value)} className="text-sm px-2 py-1.5 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 dark:text-white outline-none">
                  <option value="Co-ed">Co-ed</option><option value="Boys Only">Boys Only</option><option value="Girls Only">Girls Only</option>
                </select>
                <div className="flex items-center gap-2 px-2 border-l border-slate-300 dark:border-slate-600">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Kids/House:</span>
                  <input type="number" min="1" max="50" value={presetParticipants} onChange={(e) => setPresetParticipants(parseInt(e.target.value)||1)} className="w-12 px-1 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded outline-none text-center bg-white dark:bg-slate-700 dark:text-white"/>
                </div>
                <Button onClick={() => applyPreset('Primary')} variant="secondary" className="!text-xs !py-1.5">Primary Preset</Button>
                <Button onClick={() => applyPreset('High')}    variant="secondary" className="!text-xs !py-1.5">High School Preset</Button>
              </div>
            </div>

            <form onSubmit={handleAddActivity} className="bg-slate-50 dark:bg-slate-700/30 p-4 rounded-lg border border-slate-200 dark:border-slate-600 mb-6 space-y-3">
              <div className="flex flex-wrap gap-3 items-end">
                <div className="w-full sm:w-auto flex-1 min-w-[120px]"><label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Age Group</label><select value={newActivity.ageGroup} onChange={(e) => setNewActivity({...newActivity, ageGroup: e.target.value})} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg outline-none bg-white dark:bg-slate-700 dark:text-white">{['U10','U11','U12','U13','U14','U15','U16','U17','U18','U19','Open','U14 (Open)','U19 (Open)'].map(a => <option key={a} value={a}>{a}</option>)}</select></div>
                <div className="w-full sm:w-auto flex-1 min-w-[100px]"><label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Gender</label><select value={newActivity.gender} onChange={(e) => setNewActivity({...newActivity, gender: e.target.value})} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg outline-none bg-white dark:bg-slate-700 dark:text-white"><option value="Boys">Boys</option><option value="Girls">Girls</option><option value="Mixed">Mixed</option></select></div>
                <div className="w-full sm:w-auto flex-1 min-w-[120px]"><label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Type</label><select value={newActivity.type} onChange={(e) => setNewActivity({...newActivity, type: e.target.value})} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg outline-none bg-white dark:bg-slate-700 dark:text-white"><option value="track">Track (Time)</option><option value="field">Field (Dist)</option><option value="long_distance">Long Dist</option></select></div>
                <div className="w-full sm:w-auto flex-1 min-w-[130px]"><label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Scoring</label><select value={newActivity.scoringType} onChange={(e) => setNewActivity({...newActivity, scoringType: e.target.value})} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg outline-none bg-white dark:bg-slate-700 dark:text-white"><option value="metric">Metric (Time/Dist)</option><option value="placing">Placing (1st/2nd…)</option></select></div>
                <div className="w-full sm:w-auto flex-1 min-w-[100px]"><label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Kids/House</label><input type="number" min="1" max="50" value={newActivity.participantsPerHouse} onChange={(e) => setNewActivity({...newActivity, participantsPerHouse: parseInt(e.target.value)||2})} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg outline-none bg-white dark:bg-slate-700 dark:text-white text-center"/></div>
                <div className="w-full sm:w-auto flex-[2] min-w-[150px]"><label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Activity Name</label><input type="text" value={newActivity.name} onChange={(e) => setNewActivity({...newActivity, name: e.target.value})} placeholder="e.g., 100m Sprint" className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg outline-none bg-white dark:bg-slate-700 dark:text-white"/></div>
              </div>
              <div className="flex flex-wrap sm:flex-nowrap gap-3 items-end pt-2 border-t border-slate-200 dark:border-slate-600">
                <div className="w-full sm:w-auto flex-1"><label className="block text-xs font-medium text-amber-600 mb-1 uppercase tracking-wider flex items-center gap-1"><Trophy size={12}/> Record Value</label><input type="number" step="0.01" value={newActivity.recordValue} onChange={(e) => setNewActivity({...newActivity, recordValue: e.target.value})} placeholder="e.g., 12.45" className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg outline-none bg-white dark:bg-slate-700 dark:text-white"/></div>
                <div className="w-full sm:w-auto flex-[2]"><label className="block text-xs font-medium text-amber-600 mb-1 uppercase tracking-wider">Record Holder Name</label><input type="text" value={newActivity.recordHolder} onChange={(e) => setNewActivity({...newActivity, recordHolder: e.target.value})} placeholder="e.g., Jason B. (Red House)" className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg outline-none bg-white dark:bg-slate-700 dark:text-white"/></div>
                <Button type="submit" variant="primary" className="w-full sm:w-auto mt-2 sm:mt-0"><Plus size={20}/> Add</Button>
              </div>
            </form>

            {isLoading ? (
              <div className="text-center py-8"><Loader2 className="animate-spin mx-auto text-slate-400"/></div>
            ) : activities.length === 0 ? (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-600 rounded-lg">No activities added yet.</div>
            ) : (
              <>
                {/* Mobile card list */}
                <div className="md:hidden border border-slate-200 dark:border-slate-700 rounded-lg divide-y divide-slate-100 dark:divide-slate-700 max-h-[500px] overflow-y-auto">
                  {activities.map(act => (
                    <div key={act.id} className="px-4 py-3 flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 dark:text-white text-sm">{act.name}</span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300">{act.type.replace('_',' ').toUpperCase()}</span>
                        </div>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                          <span className="font-semibold">{act.ageGroup}</span> · <span className={act.gender === 'Boys' ? 'text-blue-500' : act.gender === 'Girls' ? 'text-pink-500' : 'text-purple-500'}>{act.gender}</span> · {act.participantsPerHouse || 2} per house
                          {act.recordValue && <span className="ml-1 text-amber-600 dark:text-amber-400"> · 🏆 {act.recordValue}</span>}
                        </p>
                      </div>
                      <button onClick={() => setModalConfig({ isOpen: true, item: act.id, type: 'activity' })} className="text-red-400 hover:text-red-600 p-1 flex-shrink-0 transition-colors"><Trash2 size={16}/></button>
                    </div>
                  ))}
                </div>
                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg max-h-[500px] overflow-y-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-600 sticky top-0 z-10">
                      <tr><th className="px-4 py-3 font-semibold">Group</th><th className="px-4 py-3 font-semibold">Activity</th><th className="px-4 py-3 font-semibold text-center">Kids/House</th><th className="px-4 py-3 font-semibold text-amber-600"><div className="flex items-center gap-1"><Trophy size={14}/> Edit Record</div></th><th className="px-4 py-3 text-right font-semibold">Action</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {activities.map(act => (
                        <tr key={act.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 group">
                          <td className="px-4 py-3 font-medium text-slate-900 dark:text-white"><span className="font-bold mr-1">{act.ageGroup}</span><span className={act.gender === 'Boys' ? 'text-blue-600' : act.gender === 'Girls' ? 'text-pink-600' : 'text-purple-600'}>{act.gender}</span></td>
                          <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{act.name} <span className="ml-2 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300">{act.type.replace('_', ' ').toUpperCase()}</span></td>
                          <td className="px-4 py-3 text-center font-semibold text-slate-700 dark:text-slate-300"><input type="number" min="1" max="100" value={act.participantsPerHouse || 2} onChange={(e) => handleUpdateActivityProp(act.id, 'participantsPerHouse', parseInt(e.target.value)||1)} className="w-16 px-2 py-1 text-center border border-slate-300 dark:border-slate-600 rounded outline-none focus:ring-2 focus:ring-sky-400 bg-white dark:bg-slate-700 dark:text-white"/></td>
                          <td className="px-4 py-3"><div className="flex items-center gap-2 opacity-50 group-hover:opacity-100 transition-opacity focus-within:opacity-100"><input type="number" step="0.01" value={act.recordValue || ''} onChange={(e) => handleUpdateActivityProp(act.id, 'recordValue', e.target.value)} onKeyDown={handleRecordKeyDown} placeholder="Val" className="record-input w-16 px-2 py-1 text-xs border border-slate-300 dark:border-slate-600 rounded outline-none focus:ring-2 focus:ring-amber-500 bg-white dark:bg-slate-700 dark:text-white"/><input type="text" value={act.recordHolder || ''} onChange={(e) => handleUpdateActivityProp(act.id, 'recordHolder', e.target.value)} onKeyDown={handleRecordKeyDown} placeholder="Holder Name" className="record-input w-32 px-2 py-1 text-xs border border-slate-300 dark:border-slate-600 rounded outline-none focus:ring-2 focus:ring-amber-500 bg-white dark:bg-slate-700 dark:text-white"/></div></td>
                          <td className="px-4 py-3 text-right"><button onClick={() => setModalConfig({ isOpen: true, item: act.id, type: 'activity' })} className="text-red-400 hover:text-red-600 p-1 transition-colors"><Trash2 size={16}/></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 7. TRIAL SETUP MODULE
// ==========================================

const TrialSetupModule = ({ onBack, user, showToast }) => {
  const [trials, setTrials]           = useState([]);
  const [selectedTrialId, setSelectedTrialId] = useState('new');
  const [isLoading, setIsLoading]     = useState(true);
  const [isSaving, setIsSaving]       = useState(false);
  const [trialName, setTrialName]     = useState('');
  const [trialDate, setTrialDate]     = useState('');
  const [modalConfig, setModalConfig] = useState({ isOpen: false, item: null });

  useEffect(() => {
    const fetchTrials = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase.from('trials').select('*').eq('school_id', user.school_id).order('trial_date', { ascending: false });
        if (error) throw error;
        setTrials(data || []);
      } catch (e) { console.error('Error fetching trials:', e); } finally { setIsLoading(false); }
    };
    fetchTrials();
  }, [user]);

  const handleTrialSelect = (id) => {
    setSelectedTrialId(id);
    if (id === 'new') { setTrialName(''); setTrialDate(''); return; }
    const t = trials.find(t => t.id === id);
    if (t) { setTrialName(t.name); setTrialDate(t.trial_date); }
  };

  const executeDelete = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase.from('trials').delete().eq('id', modalConfig.item);
      if (error) throw error;
      setModalConfig({ isOpen: false, item: null });
      showToast('Trial deleted successfully.');
      onBack();
    } catch (e) { showToast('Failed to delete trial.', 'error'); } finally { setIsSaving(false); }
  };

  const handleSaveTrial = async () => {
    if (!trialName || !trialDate) { showToast('Please provide a name and date.', 'error'); return; }
    setIsSaving(true);
    try {
      if (selectedTrialId === 'new') {
        const { error } = await supabase.from('trials').insert({ school_id: user.school_id, name: trialName, trial_date: trialDate });
        if (error) throw error;
      } else {
        const { error } = await supabase.from('trials').update({ name: trialName, trial_date: trialDate }).eq('id', selectedTrialId);
        if (error) throw error;
      }
      showToast('Trial setup saved!');
      onBack();
    } catch (e) { showToast('Failed to save trial.', 'error'); } finally { setIsSaving(false); }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <ConfirmModal isOpen={modalConfig.isOpen} title="Delete Trial" message={`Delete "${trialName}" and all associated results? This cannot be undone.`} onConfirm={executeDelete} onCancel={() => setModalConfig({ isOpen: false, item: null })}/>
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div className="flex items-center gap-4">
          <Button onClick={onBack} variant="secondary" className="!px-3 !py-2"><ArrowLeft size={18}/></Button>
          <div><h2 className="text-xl font-bold text-slate-900">Manage Trials</h2><p className="text-sm text-slate-500">Create buckets for PE assessments and practice data.</p></div>
        </div>
      </div>
      <Card className="bg-purple-50 border-purple-200">
        <label className="block text-sm font-semibold text-purple-900 mb-2">Select Trial Action</label>
        <div className="relative">
          <select value={selectedTrialId} onChange={(e) => handleTrialSelect(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none bg-white appearance-none pr-8 font-medium text-slate-700">
            <option value="new">✨ Create New Trial Session...</option>
            {trials.length > 0 && <optgroup label="Existing Trials">{trials.map(t => <option key={t.id} value={t.id}>{t.name} ({t.trial_date})</option>)}</optgroup>}
          </select>
          <ChevronDown className="absolute right-2 top-2.5 text-purple-500 pointer-events-none" size={18}/>
        </div>
      </Card>
      <Card>
        <div className="space-y-4">
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Trial Name</label><input type="text" value={trialName} onChange={(e) => setTrialName(e.target.value)} placeholder="e.g., Term 1 PE Assessment" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"/></div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Date</label><input type="date" value={trialDate} onChange={(e) => setTrialDate(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"/></div>
          <div className="flex gap-2 pt-4 border-t border-slate-100">
            {selectedTrialId !== 'new' && <Button onClick={() => setModalConfig({ isOpen: true, item: selectedTrialId })} variant="danger" disabled={isSaving}><Trash2 size={18}/></Button>}
            <Button onClick={handleSaveTrial} variant="primary" className="flex-1" disabled={isSaving}>
              {isSaving ? <><Loader2 className="animate-spin" size={18}/> Saving...</> : selectedTrialId === 'new' ? 'Create Trial' : 'Update Trial'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

// ==========================================
// 8. STUDENT DIRECTORY MODULE
// FIX: Added showToast prop so DB errors surface to the user
// ==========================================

const StudentDirectoryModule = ({ user, showToast }) => {
  const [tab, setTab]                 = useState('students');
  const [students, setStudents]       = useState([]);
  const [houseColors, setHouseColors] = useState({});
  const [isLoading, setIsLoading]     = useState(true);
  const [searchTerm, setSearchTerm]   = useState('');
  const [sortConfig, setSortConfig]   = useState({ key: 'last_name', direction: 'asc' });

  // Staff state
  const [staffList, setStaffList]     = useState([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteFirst, setInviteFirst] = useState('');
  const [inviteLast, setInviteLast]   = useState('');
  const [inviting, setInviting]       = useState(false);
  const [removeModal, setRemoveModal] = useState({ isOpen: false, id: null, name: '' });
  const [pendingInvite, setPendingInvite] = useState(null);
  const [editingRoleId, setEditingRoleId] = useState(null);

  const fetchStaff = async () => {
    setStaffLoading(true);
    try {
      const { data, error } = await supabase.from('users').select('id, first_name, last_name, email, role').eq('school_id', user.school_id).neq('role', 'super_admin');
      if (error) throw error;
      setStaffList(data || []);
    } catch (e) { showToast('Failed to load staff list', 'error'); } finally { setStaffLoading(false); }
  };

  useEffect(() => { if (tab === 'staff') fetchStaff(); }, [tab]);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const { data: stuData, error: stuErr } = await supabase.from('students').select('*').eq('school_id', user.school_id);
        if (stuErr) throw stuErr;
        if (stuData) setStudents(stuData);
        const { data: hcData } = await supabase.from('school_houses').select('*').eq('school_id', user.school_id);
        const map = {};
        (hcData || []).forEach(h => { map[h.house_name] = h.house_color; });
        setHouseColors(map);
      } catch (err) {
        console.error('Error fetching directory:', err);
        if (showToast) showToast('Failed to load student directory.', 'error');
      } finally { setIsLoading(false); }
    };
    fetchData();
  }, [user]);

  const requestSort = (key) => {
    setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }));
  };

  const filteredAndSorted = React.useMemo(() => {
    let result = students;
    if (searchTerm) {
      const t = searchTerm.toLowerCase();
      result = result.filter(s => (s.first_name||'').toLowerCase().includes(t) || (s.last_name||'').toLowerCase().includes(t) || (s.class||'').toLowerCase().includes(t));
    }
    return [...result].sort((a, b) => {
      const vA = (a[sortConfig.key]||'').toString().toLowerCase();
      const vB = (b[sortConfig.key]||'').toString().toLowerCase();
      if (vA < vB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (vA > vB) return sortConfig.direction === 'asc' ?  1 : -1;
      return 0;
    });
  }, [students, searchTerm, sortConfig]);


  const handleInviteStaff = async () => {
    if (!inviteEmail.trim() || !inviteFirst.trim() || !inviteLast.trim()) {
      showToast('Please fill in all fields', 'error'); return;
    }
    setInviting(true);
    let createdAuthId = null;
    try {
      const tempPassword = Math.random().toString(36).slice(-10) + 'Aa1!';

      // Save organiser session BEFORE signUp — Supabase switches session to the
      // new user when email confirmation is disabled, which breaks the RLS INSERT.
      const { data: { session: organisersSession } } = await supabase.auth.getSession();

      const { data: authData, error: authErr } = await supabase.auth.signUp({ email: inviteEmail.trim(), password: tempPassword });
      if (authErr) throw authErr;
      if (!authData.user) throw new Error('Could not create account');
      createdAuthId = authData.user.id;

      // Restore organiser session so the INSERT runs with the correct auth.uid()
      if (organisersSession) {
        const { error: sessionErr } = await supabase.auth.setSession({
          access_token: organisersSession.access_token,
          refresh_token: organisersSession.refresh_token,
        });
        if (sessionErr) throw new Error('Session restore failed — please refresh and try again.');
      }

      const { error: userErr } = await supabase.from('users').insert({
        id: createdAuthId, school_id: user.school_id,
        email: inviteEmail.trim(), first_name: inviteFirst.trim(),
        last_name: inviteLast.trim(), role: 'staff',
      });
      if (userErr) throw userErr;
      setPendingInvite({ name: inviteFirst.trim(), email: inviteEmail.trim(), password: tempPassword });
      setInviteEmail(''); setInviteFirst(''); setInviteLast('');
      fetchStaff();
    } catch (e) {
      showToast(e.message || 'Invite failed', 'error');
    } finally { setInviting(false); }
  };

  const handleRoleChange = async (staffId, newRole) => {
    const { error } = await supabase.from('users').update({ role: newRole }).eq('id', staffId);
    if (error) { showToast('Failed to update role', 'error'); return; }
    setEditingRoleId(null);
    showToast('Role updated');
    fetchStaff();
  };

  const handleRemoveStaff = async () => {
    const { id: staffId, name } = removeModal;
    setRemoveModal({ isOpen: false, id: null, name: '' });
    const { error } = await supabase.from('users').delete().eq('id', staffId);
    if (error) { showToast('Failed to remove staff member', 'error'); return; }
    showToast(`${name} removed`);
    fetchStaff();
  };

  return (
    <div className="space-y-6">
      <ConfirmModal isOpen={removeModal.isOpen} title="Remove Staff Member" message={`Remove ${removeModal.name} from your school?\n\nNote: their login account remains active in the system — only their school access is revoked. Contact your Supabase admin to fully delete the account if needed.`} confirmText="Remove" onConfirm={handleRemoveStaff} onCancel={() => setRemoveModal({ isOpen: false, id: null, name: '' })}/>
      {/* Header + tabs */}
      <div className="border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between pb-0">
          <div className="pb-4">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Directory</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm">Manage students and staff accounts</p>
          </div>
          {tab === 'students' && (
            <div className="relative w-full md:w-64 pb-4">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={18}/>
              <input type="text" placeholder="Search names or class..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-sky-400"/>
            </div>
          )}
        </div>
        <div className="flex gap-1 -mb-px">
          {[['students', `Students (${students.length})`], ['staff', 'Staff & Accounts']].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${tab === id ? 'border-sky-500 text-sky-600 dark:text-sky-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── STUDENTS TAB ── */}
      {tab === 'students' && (
        <Card className="!p-0 overflow-hidden">
          {isLoading ? (
            <div className="py-12 flex justify-center"><Loader2 className="animate-spin text-slate-400" size={24}/></div>
          ) : filteredAndSorted.length === 0 ? (
            <p className="text-center py-12 text-slate-500">No students found. Import a class list first.</p>
          ) : (
            <>
              {/* Mobile card list */}
              <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-700">
                {filteredAndSorted.map(student => (
                  <div key={student.id} className="flex items-center gap-3 px-4 py-3">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-0.5 ${getHouseColor(student.house, houseColors)}`}/>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 dark:text-white text-sm">{student.last_name}, {student.first_name}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{student.class} · {student.age_group} · {student.gender} · {student.house || 'Unassigned'}</p>
                    </div>
                  </div>
                ))}
              </div>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto max-h-[600px] overflow-y-auto">
                <table className="w-full text-sm text-left relative">
                  <thead className="bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-600 sticky top-0 z-10 shadow-sm">
                    <tr><SortableHeader label="Last Name" sortKey="last_name" sortConfig={sortConfig} onSort={requestSort}/><SortableHeader label="First Name" sortKey="first_name" sortConfig={sortConfig} onSort={requestSort}/><SortableHeader label="Class" sortKey="class" sortConfig={sortConfig} onSort={requestSort}/><SortableHeader label="Age Group" sortKey="age_group" sortConfig={sortConfig} onSort={requestSort}/><SortableHeader label="Gender" sortKey="gender" sortConfig={sortConfig} onSort={requestSort}/><SortableHeader label="House" sortKey="house" sortConfig={sortConfig} onSort={requestSort}/></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {filteredAndSorted.map((student, index) => {
                      let showSep = false, sepLabel = '';
                      if (index > 0 && !['last_name','first_name'].includes(sortConfig.key)) {
                        if (student[sortConfig.key] !== filteredAndSorted[index - 1][sortConfig.key]) { showSep = true; sepLabel = student[sortConfig.key]; }
                      }
                      if (index === 0 && !['last_name','first_name'].includes(sortConfig.key)) { showSep = true; sepLabel = student[sortConfig.key]; }
                      return (
                        <React.Fragment key={student.id}>
                          {showSep && <tr className="bg-slate-100/80 dark:bg-slate-700/40"><td colSpan="6" className="px-4 py-1.5 font-bold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider border-y border-slate-200 dark:border-slate-600">{sortConfig.key.replace('_',' ')}: {sepLabel || 'Unassigned'}</td></tr>}
                          <tr className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                            <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{student.last_name}</td>
                            <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{student.first_name}</td>
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-400 font-medium">{student.class}</td>
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{student.age_group}</td>
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{student.gender}</td>
                            <td className="px-4 py-3 text-slate-500 dark:text-slate-400"><span className={`inline-block w-2 h-2 rounded-full mr-2 ${getHouseColor(student.house, houseColors)}`}></span>{student.house || 'Unassigned'}</td>
                          </tr>
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>
      )}

      {/* ── STAFF TAB ── */}
      {tab === 'staff' && (
        <div className="space-y-6">
          {/* Invite form */}
          <Card>
            <h3 className="font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2"><UserPlus size={18} className="text-sky-500"/> Add Staff Member</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
              Creates a login account. A temporary password will be shown — share it with the staff member directly.
            </p>
            {/* TODO before launch: remove this banner once upgraded to Supabase Pro — Pro enables email invites */}
            <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-300 flex gap-2">
              <AlertCircle size={14} className="shrink-0 mt-0.5"/>
              <span><strong>Free tier note:</strong> Disable "Enable email confirmations" in Supabase Dashboard → Authentication → Providers → Email, otherwise the staff member cannot log in until they click a confirmation email. Upgrade to Pro to enable proper email invites.</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">First Name</label>
                <input value={inviteFirst} onChange={e => setInviteFirst(e.target.value)} placeholder="Jane"
                  className="w-full border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"/>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Last Name</label>
                <input value={inviteLast} onChange={e => setInviteLast(e.target.value)} placeholder="Smith"
                  className="w-full border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"/>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Email Address</label>
                <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="jane@school.edu"
                  className="w-full border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"/>
              </div>
            </div>
            <div className="mt-4">
              <Button onClick={handleInviteStaff} disabled={inviting}>
                {inviting ? <Loader2 size={16} className="animate-spin"/> : <UserPlus size={16}/>}
                {inviting ? 'Adding...' : 'Add Staff Member'}
              </Button>
            </div>
            {pendingInvite && (
              <div className="mt-4 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl space-y-2">
                <p className="font-bold text-emerald-800 dark:text-emerald-300 text-sm">Account created for {pendingInvite.name}!</p>
                <p className="text-xs text-emerald-700 dark:text-emerald-400">Share these details with them. They can change their password after first login.</p>
                <div className="flex gap-2 items-center bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-700 rounded-xl p-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Email</p>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{pendingInvite.email}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Temporary Password</p>
                    <p className="font-mono font-bold text-slate-900 dark:text-white text-sm">{pendingInvite.password}</p>
                  </div>
                  <button onClick={() => { navigator.clipboard.writeText(`Email: ${pendingInvite.email}\nPassword: ${pendingInvite.password}`); showToast('Copied!'); }}
                    className="px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition-colors shrink-0">
                    Copy
                  </button>
                </div>
                <button onClick={() => setPendingInvite(null)} className="text-xs text-slate-400 hover:text-slate-600 underline">Dismiss</button>
              </div>
            )}
          </Card>

          {/* Staff list */}
          <Card className="!p-0 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-white">Your School's Accounts</h3>
              {staffLoading && <Loader2 size={16} className="animate-spin text-slate-400"/>}
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {staffList.length === 0 && !staffLoading ? (
                <p className="px-6 py-8 text-center text-slate-400 text-sm">No staff accounts yet — add one above.</p>
              ) : staffList.map(s => (
                <div key={s.id} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                  <div className="w-9 h-9 rounded-full bg-sky-100 dark:bg-sky-900/40 flex items-center justify-center text-sky-600 dark:text-sky-400 font-bold text-sm flex-shrink-0">
                    {(s.first_name || '?')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-white text-sm">{s.first_name} {s.last_name}</p>
                    <p className="text-xs text-slate-400 truncate">{s.email}</p>
                  </div>
                  {editingRoleId === s.id ? (
                    <select autoFocus value={s.role} onChange={e => handleRoleChange(s.id, e.target.value)} onBlur={() => setEditingRoleId(null)}
                      className="text-xs border border-sky-300 dark:border-sky-600 rounded-lg px-2 py-1.5 outline-none ring-2 ring-sky-400 bg-white dark:bg-slate-700 dark:text-white font-semibold cursor-pointer">
                      <option value="staff">staff</option>
                      <option value="organiser">organiser</option>
                    </select>
                  ) : (
                    <div className="flex items-center gap-1 group/role">
                      <Badge color={s.role === 'organiser' ? 'blue' : 'slate'}>{s.role}</Badge>
                      {s.id !== user.id && (
                        <button onClick={() => setEditingRoleId(s.id)}
                          className="p-1 text-slate-300 hover:text-slate-500 dark:hover:text-slate-300 opacity-0 group-hover/role:opacity-100 transition-opacity" title="Change role">
                          <Edit size={12}/>
                        </button>
                      )}
                    </div>
                  )}
                  {s.id !== user.id && (
                    <button onClick={() => setRemoveModal({ isOpen: true, id: s.id, name: `${s.first_name} ${s.last_name}` })}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                      <UserMinus size={16}/>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

// ==========================================
// 9. ORGANISER LIVE STANDINGS
// FIX: Uses shared calculateStandings() instead of duplicating the logic
// ==========================================

const LiveStandingsModule = ({ user }) => {
  const [events, setEvents]             = useState([]);
  const [houseColors, setHouseColors]   = useState({});
  const [selectedEventId, setSelectedEventId] = useState('');
  const [standings, setStandings]       = useState([]);
  const [recentResults, setRecentResults] = useState([]);
  const [isLoading, setIsLoading]       = useState(true);
  const [projector, setProjector]       = useState(false);

  useEffect(() => {
    const fetchEventsAndColors = async () => {
      try {
        const { data: hcData } = await supabase.from('school_houses').select('*').eq('school_id', user.school_id);
        const map = {};
        (hcData || []).forEach(h => { map[h.house_name] = h.house_color; });
        setHouseColors(map);
        const { data } = await supabase.from('events').select('*').eq('school_id', user.school_id).order('created_at', { ascending: false });
        if (data && data.length > 0) { setEvents(data); setSelectedEventId(data[0].id); }
      } catch (e) { console.error(e); showToast('Failed to load events', 'error'); }
    };
    fetchEventsAndColors();
  }, [user]);

  useEffect(() => {
    if (!selectedEventId) { setIsLoading(false); return; }
    const fetchLiveData = async () => {
      setIsLoading(true);
      try {
        const { data: activities } = await supabase.from('event_activities').select('id, name, activity_type, age_group, gender').eq('event_id', selectedEventId);
        if (!activities || activities.length === 0) { setStandings([]); setRecentResults([]); return; }
        const { data: results } = await supabase.from('event_results').select('*, students(*)').in('event_activity_id', activities.map(a => a.id)).order('recorded_at', { ascending: false });
        if (!results) { setStandings([]); setRecentResults([]); return; }

        // FIX: Use shared calculateStandings — also mutates results with calculated_points
        const newStandings = calculateStandings(results, activities, houseColors);
        setStandings(newStandings);

        setRecentResults(results.map(r => {
          const act = activities.find(a => a.id === r.event_activity_id);
          const suffix = act?.activity_type === 'track' ? 's' : 'm';
          let timeStr = '';
          try { timeStr = new Date(r.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); } catch (e) { timeStr = 'Just now'; }
          const sd = (Array.isArray(r.students) ? r.students[0] : r.students) || {};
          return { id: r.id, event: `${act?.age_group} ${act?.gender} ${act?.name}`, time: timeStr, winner: `${sd.first_name || 'Unknown'} ${sd.last_name || ''}`, house: sd.house || 'Unassigned', houseColor: getHouseColor(sd.house, houseColors), metric: `${r.result_value}${suffix}`, isRecord: r.is_new_record, points: r.calculated_points || 0 };
        }));
      } catch (e) { console.error(e); } finally { setIsLoading(false); }
    };
    fetchLiveData();
    const interval = setInterval(fetchLiveData, 30000);
    return () => clearInterval(interval);
  }, [selectedEventId, houseColors]);

  const eventName = events.find(e => e.id === selectedEventId)?.name || 'Sports Day';

  if (projector) return (
    <div className="fixed inset-0 bg-slate-900 z-50 flex flex-col p-8 overflow-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-sky-400 text-sm font-semibold uppercase tracking-widest mb-1">Live Standings</p>
          <h1 className="text-4xl font-black text-white">{eventName}</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-2 text-emerald-400 text-sm font-semibold">
            <span className="relative flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"/><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"/></span>
            Live
          </span>
          <button onClick={() => setProjector(false)} className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-semibold transition-colors flex items-center gap-2">
            <X size={16}/> Exit
          </button>
        </div>
      </div>
      <div className="flex-1 flex flex-col justify-center gap-4 max-w-2xl mx-auto w-full">
        {standings.length === 0 ? (
          <p className="text-slate-500 text-center text-xl">No results yet — waiting for first scores…</p>
        ) : standings.map((house, i) => {
          const maxPts = standings[0]?.points || 1;
          const pct    = Math.round((house.points / maxPts) * 100);
          const medals = ['🥇','🥈','🥉'];
          return (
            <div key={house.name} className="bg-white/5 rounded-2xl p-5 border border-white/10">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-4">
                  <span className="text-3xl">{medals[i] || `${i+1}`}</span>
                  <div className={`w-4 h-10 rounded-full ${house.color}`}/>
                  <span className="text-2xl font-black text-white">{house.name}</span>
                </div>
                <span className="text-4xl font-black text-white">{house.points}<span className="text-lg text-slate-400 ml-1">pts</span></span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-2">
                <div className={`${house.color} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }}/>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-center text-slate-600 text-xs mt-8">Auto-refreshes every 30 seconds</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-4 hide-on-print">
        <div><h2 className="text-xl font-bold text-slate-900 dark:text-white">Live Standings &amp; Reports</h2><p className="text-sm text-slate-500 dark:text-slate-400">Real-time event scores and printable report.</p></div>
        <div className="flex items-center gap-3">
          <select value={selectedEventId} onChange={(e) => setSelectedEventId(e.target.value)} className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg outline-none bg-white dark:bg-slate-700 dark:text-white font-medium text-slate-700">
            {events.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <button onClick={() => setProjector(true)} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-sky-50 dark:hover:bg-sky-900/20 hover:text-sky-600 hover:border-sky-300 transition-colors">
            <Radio size={16}/> Projector
          </button>
          <Button onClick={() => window.print()} variant="secondary"><Printer size={18}/> Print Report</Button>
        </div>
      </div>

      {/* ── PRINT-ONLY REPORT ── */}
      <div className="print-only">
        {/* Cover header */}
        <div style={{ borderBottom: '3px solid #0ea5e9', paddingBottom: '12px', marginBottom: '20px' }}>
          <h1 style={{ fontSize: '26px', fontWeight: 900, margin: 0, color: '#0f172a' }}>{eventName}</h1>
          <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0' }}>
            Official Results &amp; Standings · Printed {new Date().toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        {/* House standings table */}
        <div className="print-avoid-break" style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#475569', marginBottom: '8px' }}>Overall House Standings</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f1f5f9' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#334155', width: '48px' }}>Pos</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#334155' }}>House</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#334155' }}>Points</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((house, i) => (
                <tr key={house.name} style={{ borderBottom: '1px solid #e2e8f0', background: i === 0 ? '#fefce8' : 'white' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 700, color: i === 0 ? '#92400e' : '#64748b', fontSize: '16px' }}>{i + 1}</td>
                  <td style={{ padding: '8px 12px', fontWeight: 600, color: '#0f172a' }}>{house.name}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 900, fontSize: '18px', color: '#0f172a' }}>{house.points} <span style={{ fontSize: '10px', fontWeight: 600, color: '#94a3b8' }}>pts</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Results grouped by activity */}
        {(() => {
          const grouped = {};
          recentResults.forEach(r => {
            if (!grouped[r.event]) grouped[r.event] = [];
            grouped[r.event].push(r);
          });
          return Object.entries(grouped).map(([eventLabel, rows], gi) => (
            <div key={eventLabel} className="print-avoid-break" style={{ marginBottom: '18px' }}>
              <h3 style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#0ea5e9', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px', marginBottom: '6px' }}>{eventLabel}</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={{ padding: '5px 10px', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>Student</th>
                    <th style={{ padding: '5px 10px', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>House</th>
                    <th style={{ padding: '5px 10px', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>Pts</th>
                    <th style={{ padding: '5px 10px', textAlign: 'right', color: '#64748b', fontWeight: 600 }}>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.sort((a, b) => b.points - a.points).map((r, ri) => (
                    <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9', background: ri % 2 === 0 ? 'white' : '#f8fafc' }}>
                      <td style={{ padding: '5px 10px', fontWeight: 500, color: '#0f172a' }}>{r.winner}</td>
                      <td style={{ padding: '5px 10px', color: '#475569' }}>{r.house}</td>
                      <td style={{ padding: '5px 10px', textAlign: 'center', fontWeight: 700, color: '#2563eb' }}>+{r.points}</td>
                      <td style={{ padding: '5px 10px', textAlign: 'right', fontWeight: 700, color: r.isRecord ? '#b45309' : '#0f172a', fontFamily: 'monospace' }}>
                        {r.isRecord ? '★ ' : ''}{r.metric}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ));
        })()}

        <div style={{ marginTop: '24px', borderTop: '1px solid #e2e8f0', paddingTop: '8px', fontSize: '10px', color: '#94a3b8', textAlign: 'center' }}>
          Generated by SportsDay Pro · {new Date().toLocaleString()}
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 screen-only"><Loader2 className="animate-spin mx-auto text-slate-400" size={32}/></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start screen-only">
          <div className="lg:col-span-4 space-y-4 print-full-width">
            <h3 className="font-bold text-slate-900 dark:text-slate-200 uppercase tracking-widest text-sm flex items-center gap-2 mb-4"><Trophy size={16} className="text-amber-500"/> Overall Points</h3>
            {standings.length === 0 ? (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-800/50">No points calculated yet.</div>
            ) : standings.map((house, i) => (
              <div key={house.name} className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-4"><span className="text-2xl font-bold text-slate-300 dark:text-slate-600 w-4">{i + 1}</span><div className={`w-3 h-10 rounded-full ${house.color}`}></div><span className="font-bold text-slate-900 dark:text-white">{house.name}</span></div>
                <span className="text-2xl font-black text-slate-800 dark:text-white">{house.points} <span className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase">pts</span></span>
              </div>
            ))}
          </div>
          <div className="lg:col-span-8 space-y-4 print-full-width mt-8 lg:mt-0">
            <h3 className="font-bold text-slate-900 dark:text-slate-200 uppercase tracking-widest text-sm flex items-center gap-2 mb-4"><ClipboardList size={16} className="text-blue-500"/> Complete Results</h3>
            {recentResults.length === 0 ? (
              <div className="text-center py-12 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/50">No results recorded for this event.</div>
            ) : (
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-600"><tr><th className="px-4 py-3 font-semibold">Event</th><th className="px-4 py-3 font-semibold">Student</th><th className="px-4 py-3 font-semibold">House</th><th className="px-4 py-3 font-semibold text-center">Pts</th><th className="px-4 py-3 font-semibold text-right">Result</th></tr></thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {recentResults.map(r => (
                      <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{r.event}</td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{r.winner}</td>
                        <td className="px-4 py-3"><span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300"><div className={`w-2 h-2 rounded-full ${r.houseColor}`}></div> {r.house}</span></td>
                        <td className="px-4 py-3 text-center font-bold text-blue-600 dark:text-blue-400">+{r.points}</td>
                        <td className="px-4 py-3 text-right"><span className={`font-mono font-bold px-2 py-1 rounded ${r.isRecord ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-700' : 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white'}`}>{r.isRecord && <Medal size={12} className="inline mr-1 -mt-0.5 text-amber-500"/>}{r.metric}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ==========================================
// 10. ORGANISER PORTAL DASHBOARD
// FIX: Passes showToast to StudentDirectoryModule
// ==========================================

const OrganiserDashboard = ({ user, currentView, setCurrentView, showToast, onFlagsChange }) => {
  const [studentCount, setStudentCount] = useState(0);
  const [staffCount, setStaffCount]     = useState(0);
  const [houseCount, setHouseCount]     = useState(0);
  const [eventCount, setEventCount]     = useState(0);
  const [trialCount, setTrialCount]     = useState(0);
  const [isLoadingCount, setIsLoadingCount] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      if (!user?.school_id) return;
      setIsLoadingCount(true);
      try {
        const [{ count: sC }, { count: eC }, { count: tC }, { count: stC }, { count: hC }] = await Promise.all([
          supabase.from('students').select('*', { count: 'exact', head: true }).eq('school_id', user.school_id),
          supabase.from('events').select('*', { count: 'exact', head: true }).eq('school_id', user.school_id),
          supabase.from('trials').select('*', { count: 'exact', head: true }).eq('school_id', user.school_id),
          supabase.from('users').select('*', { count: 'exact', head: true }).eq('school_id', user.school_id).eq('role', 'staff'),
          supabase.from('school_houses').select('*', { count: 'exact', head: true }).eq('school_id', user.school_id),
        ]);
        setStudentCount(sC || 0); setEventCount(eC || 0); setTrialCount(tC || 0); setStaffCount(stC || 0); setHouseCount(hC || 0);
      } catch (e) { console.error('Error fetching stats:', e); } finally { setIsLoadingCount(false); }
    };
    if (currentView === 'dashboard') fetchStats();
  }, [user, currentView]);

  if (currentView === 'import')      return <DataImportModule onBack={() => setCurrentView('dashboard')} user={user} showToast={showToast}/>;
  if (currentView === 'event-setup') return <EventSetupModule onBack={() => setCurrentView('dashboard')} user={user} showToast={showToast}/>;
  if (currentView === 'trial-setup') return <TrialSetupModule onBack={() => setCurrentView('dashboard')} user={user} showToast={showToast}/>;
  if (currentView === 'students')    return <StudentDirectoryModule user={user} showToast={showToast}/>;
  if (currentView === 'standings')   return <LiveStandingsModule user={user}/>;
  if (currentView === 'houses')      return <HouseSetupModule onBack={() => setCurrentView('dashboard')} user={user} showToast={showToast}/>;
  if (currentView === 'records')     return <RecordBoardModule user={user} showToast={showToast}/>;
  if (currentView === 'flags')       return <FlagsModule user={user} showToast={showToast} onCountChange={onFlagsChange}/>;

  const setupSteps = [
    { label: 'Add staff accounts',    desc: 'Give staff login access to enter results',   view: 'students',    done: staffCount > 0,  icon: UserPlus },
    { label: 'Import class lists',    desc: 'Upload your student CSV to get started',      view: 'import',      done: studentCount > 0, icon: Users },
    { label: 'Set up houses',         desc: 'Assign colours to your school houses',        view: 'houses',      done: houseCount > 0,  icon: Palette },
    { label: 'Create an event',       desc: 'Build your sports day with activities',       view: 'event-setup', done: eventCount > 0,  icon: Calendar },
  ];
  const setupDone = setupSteps.filter(s => s.done).length;
  const allDone   = setupDone === setupSteps.length;

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div className="bg-gradient-to-r from-sky-500 to-sky-600 rounded-2xl p-6 text-white">
        <p className="text-sky-100 text-sm font-medium mb-1">Welcome back</p>
        <h1 className="text-2xl font-black">{user.first_name} 👋</h1>
        <p className="text-sky-100 text-sm mt-1">Here's your sports day at a glance.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {isLoadingCount ? (
          <div className="col-span-3 flex justify-center py-8"><Loader2 className="animate-spin text-slate-300" size={28}/></div>
        ) : (
          <>
            <StatCard icon={Users}    label="Imported Students" value={studentCount} color="sky"/>
            <StatCard icon={Trophy}   label="Total Events"      value={eventCount}   color="amber"/>
            <StatCard icon={Activity} label="Active Trials"     value={trialCount}   color="purple"/>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Getting started checklist */}
        {!allDone && (
          <div className="lg:col-span-2">
            <Card>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-bold text-slate-900 dark:text-white">Getting Started</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Complete these steps before your first event</p>
                </div>
                <span className="text-sm font-bold text-sky-600 dark:text-sky-400">{setupDone}/{setupSteps.length} done</span>
              </div>
              {/* Progress bar */}
              <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-1.5 mb-5">
                <div className="bg-sky-500 h-1.5 rounded-full transition-all" style={{ width: `${(setupDone / setupSteps.length) * 100}%` }}/>
              </div>
              <div className="space-y-3">
                {setupSteps.map(({ label, desc, view, done, icon: Icon }) => (
                  <button key={view} onClick={() => setCurrentView(view)}
                    className={`w-full flex items-center gap-4 p-3.5 rounded-xl border text-left transition-all group ${done ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20' : 'border-slate-200 dark:border-slate-600 hover:border-sky-300 hover:bg-sky-50 dark:hover:border-sky-700 dark:hover:bg-sky-900/20'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${done ? 'bg-emerald-500' : 'bg-slate-100 dark:bg-slate-700 group-hover:bg-sky-100 dark:group-hover:bg-sky-900/40'}`}>
                      {done
                        ? <CheckCircle2 size={16} className="text-white"/>
                        : <Icon size={16} className="text-slate-500 dark:text-slate-400 group-hover:text-sky-600"/>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold ${done ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-slate-200'}`}>{label}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{desc}</p>
                    </div>
                    {!done && <ChevronDown size={16} className="-rotate-90 text-slate-400 group-hover:text-sky-500 flex-shrink-0"/>}
                  </button>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* Quick Actions */}
        <div className={allDone ? 'lg:col-span-3' : ''}>
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Quick Actions</h2>
          <div className={`grid gap-3 ${allDone ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-1 sm:grid-cols-2'}`}>
            {[
              { label: 'Upload Class Lists', icon: Users,     view: 'import'      },
              { label: 'Manage Events',      icon: Settings,  view: 'event-setup' },
              { label: 'Manage Houses',      icon: Palette,   view: 'houses'      },
              { label: 'Live Standings',     icon: Trophy,    view: 'standings'   },
            ].map(({ label, icon: Icon, view }) => (
              <button key={view} onClick={() => setCurrentView(view)}
                className="flex items-center gap-3 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-sky-300 dark:hover:border-sky-700 hover:bg-sky-50 dark:hover:bg-sky-900/20 text-left transition-all group">
                <div className="w-9 h-9 rounded-xl bg-sky-50 dark:bg-sky-900/30 flex items-center justify-center group-hover:bg-sky-100 dark:group-hover:bg-sky-900/50 transition-colors">
                  <Icon size={18} className="text-sky-500"/>
                </div>
                <span className="font-semibold text-sm text-slate-700 dark:text-slate-300">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 11. STAFF DATA ENTRY PORTAL
// FIX: Replaced hidden/block toggle with proper conditional rendering
//      so only one component is mounted at a time.
// ==========================================

const StaffDashboard = ({ user, showToast }) => {
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [houseColors, setHouseColors]           = useState({});
  const [schoolRecords, setSchoolRecords]       = useState([]);

  const fetchGlobals = useCallback(async () => {
    try {
      const { data: hcData } = await supabase.from('school_houses').select('*').eq('school_id', user.school_id);
      const map = {};
      (hcData || []).forEach(h => { map[h.house_name] = h.house_color; });
      setHouseColors(map);
      const { data: rData } = await supabase.from('event_records').select('*').eq('school_id', user.school_id);
      if (rData) setSchoolRecords(rData);
    } catch (e) {}
  }, [user]);

  useEffect(() => {
    if (user?.school_id) fetchGlobals();
  }, [user, fetchGlobals]);

  // FIX: Conditional rendering — only one child is mounted at a time
  if (selectedActivity) {
    return (
      <StaffScoringView
        user={user}
        showToast={showToast}
        activity={selectedActivity}
        houseColors={houseColors}
        schoolRecords={schoolRecords}
        onClose={() => { setSelectedActivity(null); }}
        refreshRecords={fetchGlobals}
      />
    );
  }

  return (
    <StaffDashboardMenu
      user={user}
      showToast={showToast}
      houseColors={houseColors}
      schoolRecords={schoolRecords}
      onSelectActivity={(act) => setSelectedActivity(act)}
    />
  );
};

// --- STAFF DASHBOARD: MENU ---
const StaffDashboardMenu = ({ user, showToast, houseColors, schoolRecords, onSelectActivity }) => {
  const [mode, setMode]                         = useState('events');
  const [allEvents, setAllEvents]               = useState([]);
  const [assignedActivities, setAssignedActivities] = useState([]);
  const [selectedEventId, setSelectedEventId]   = useState(() => localStorage.getItem('sdp-staff-event') || '');
  const [allTrials, setAllTrials]               = useState([]);
  const [selectedTrialId, setSelectedTrialId]   = useState('');
  const [trialFilters, setTrialFilters]         = useState({ ageGroup: 'All', className: '', house: 'All', gender: 'All', customActivityName: '', unit: 'seconds' });
  const [trialHistory, setTrialHistory]         = useState([]);
  const [isLoading, setIsLoading]               = useState(false);
  const [modalConfig, setModalConfig]           = useState({ isOpen: false, type: null, payload: null });
  const [editingHistory, setEditingHistory]     = useState(null);
  const [resultCounts, setResultCounts]         = useState({});

  useEffect(() => {
    const fetchContexts = async () => {
      try {
        const { data: eData } = await supabase.from('events').select('id, name, event_date, is_active').eq('school_id', user.school_id).order('event_date', { ascending: false });
        if (eData && eData.length > 0) {
          setAllEvents(eData);
          const saved = localStorage.getItem('sdp-staff-event');
          const preferred = eData.find(e => e.id === saved) || eData.find(e => e.is_active) || eData[0];
          setSelectedEventId(preferred.id);
          localStorage.setItem('sdp-staff-event', preferred.id);
        }
        const { data: tData } = await supabase.from('trials').select('id, name, trial_date').eq('school_id', user.school_id).order('trial_date', { ascending: false });
        if (tData && tData.length > 0) { setAllTrials(tData); setSelectedTrialId(tData[0].id); }
      } catch (e) { console.error('Error fetching contexts:', e); showToast('Failed to load events', 'error'); }
    };
    if (user?.school_id) fetchContexts();
  }, [user]);

  const refreshResultCounts = useCallback(async (activities) => {
    if (!activities || activities.length === 0) return;
    const { data } = await supabase
      .from('event_results')
      .select('event_activity_id')
      .in('event_activity_id', activities.map(a => a.id));
    const counts = {};
    (data || []).forEach(r => { counts[r.event_activity_id] = (counts[r.event_activity_id] || 0) + 1; });
    setResultCounts(counts);
  }, []);

  useEffect(() => {
    if (mode !== 'events' || !selectedEventId) return;
    const fetchActivities = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase.from('event_activities').select('*').eq('event_id', selectedEventId);
        if (error) throw error;
        setAssignedActivities(data || []);
        await refreshResultCounts(data || []);
      } catch (e) { console.error(e); showToast('Failed to load activities', 'error'); } finally { setIsLoading(false); }
    };
    fetchActivities();
  }, [selectedEventId, mode, refreshResultCounts]);

  // FIX: Wrap fetchHistory in useCallback with selectedTrialId as dep
  // to avoid a stale closure when called from openHistorySession or handleStartTrial
  const fetchHistory = useCallback(async () => {
    if (!selectedTrialId) return;
    try {
      const { data, error } = await supabase.from('trial_results').select('activity_name, unit').eq('trial_id', selectedTrialId);
      if (error) return;
      const uniqueActs = [];
      const seen = new Set();
      (data || []).forEach(tr => {
        if (!seen.has(tr.activity_name)) {
          seen.add(tr.activity_name);
          uniqueActs.push({ name: tr.activity_name, unit: tr.unit, date: 'Saved' });
        }
      });
      setTrialHistory(uniqueActs);
    } catch (e) { console.error('History fetch error', e); }
  }, [selectedTrialId]);

  useEffect(() => {
    if (mode === 'trials' && selectedTrialId) fetchHistory();
  }, [selectedTrialId, mode, fetchHistory]);

  const handleStartTrial = () => {
    if (!trialFilters.customActivityName) { showToast('Please provide an activity name (e.g., 100m Sprint).', 'error'); return; }
    const t = allTrials.find(t => t.id === selectedTrialId);
    onSelectActivity({ isTrial: true, trialData: t, filters: trialFilters, refreshHistoryCallback: fetchHistory });
  };

  const openHistorySession = (item) => {
    const filters = { ...trialFilters, customActivityName: item.name, unit: item.unit };
    const t = allTrials.find(t => t.id === selectedTrialId);
    onSelectActivity({ isTrial: true, trialData: t, filters, isHistory: true, refreshHistoryCallback: fetchHistory });
  };

  const confirmDeleteHistory = async () => {
    const item = modalConfig.payload;
    setModalConfig({ isOpen: false, type: null, payload: null });
    try {
      await supabase.from('trial_results').delete().eq('trial_id', selectedTrialId).eq('activity_name', item.name);
      setTrialHistory(prev => prev.filter(h => h.name !== item.name));
      showToast('Trial data deleted.');
    } catch (e) { showToast('Failed to delete trial data', 'error'); }
  };

  const saveHistoryName = async () => {
    if (!editingHistory.newName.trim()) return;
    try {
      const { error } = await supabase.from('trial_results').update({ activity_name: editingHistory.newName.trim() }).eq('trial_id', selectedTrialId).eq('activity_name', editingHistory.oldName);
      if (error) throw error;
      showToast('Trial name updated.');
      setEditingHistory(null);
      fetchHistory();
    } catch (e) { showToast('Failed to update trial name', 'error'); }
  };

  return (
    <div className="space-y-6">
      <ConfirmModal isOpen={modalConfig.isOpen && modalConfig.type === 'delete-history'} title="Delete Trial Data" message={`Permanently delete all data recorded for "${modalConfig.payload?.name}" in this session?`} onConfirm={confirmDeleteHistory} onCancel={() => setModalConfig({ isOpen: false, type: null, payload: null })}/>
      <header className="mb-6 border-b border-slate-200 dark:border-slate-700 pb-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Staff Data Entry</h1>
        <p className="text-slate-500 dark:text-slate-400">Welcome, {user.first_name}. Choose a mode to begin recording data.</p>
        <div className="flex bg-slate-200 dark:bg-slate-700 p-1 rounded-lg w-full sm:w-64 mt-4">
          <button onClick={() => setMode('events')} className={`flex-1 py-1.5 text-sm font-semibold rounded-md transition-colors ${mode === 'events' ? 'bg-white dark:bg-slate-600 text-blue-700 dark:text-blue-400 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>Main Events</button>
          <button onClick={() => setMode('trials')} className={`flex-1 py-1.5 text-sm font-semibold rounded-md transition-colors ${mode === 'trials' ? 'bg-white dark:bg-slate-600 text-purple-700 dark:text-purple-400 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>Trials / PE</button>
        </div>
      </header>

      {mode === 'events' && (
        <>
          <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
            <label className="font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">Current Event:</label>
            <div className="relative w-full sm:max-w-md">
              <select value={selectedEventId} onChange={(e) => { setSelectedEventId(e.target.value); localStorage.setItem('sdp-staff-event', e.target.value); }} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg outline-none bg-white dark:bg-slate-700 dark:text-white font-medium shadow-sm appearance-none pr-8">
                {allEvents.length === 0 ? <option value="">No events available</option> : allEvents.map(evt => <option key={evt.id} value={evt.id}>{evt.name}{evt.is_active ? ' (Active)' : ''}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-2.5 text-slate-500 pointer-events-none" size={18}/>
            </div>
          </div>

          {!selectedEventId ? (
            <Card className="text-center py-12"><Trophy size={48} className="mx-auto text-slate-300 mb-4"/><p className="text-slate-500">No events found.</p></Card>
          ) : assignedActivities.length === 0 ? (
            <Card className="text-center py-12 text-slate-500">No activities configured for this event.</Card>
          ) : (
            <>
              {/* Progress summary */}
              {(() => {
                const done = assignedActivities.filter(a => (resultCounts[a.id] || 0) > 0).length;
                const total = assignedActivities.length;
                return (
                  <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 mb-2">
                    <div className="flex-1">
                      <div className="flex justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                        <span>Activities completed</span>
                        <span>{done}/{total}</span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5">
                        <div className="bg-emerald-500 h-1.5 rounded-full transition-all" style={{ width: `${total > 0 ? (done/total)*100 : 0}%` }}/>
                      </div>
                    </div>
                    {done === total && total > 0 && (
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><CheckCircle2 size={14}/> All done!</span>
                    )}
                  </div>
                );
              })()}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {assignedActivities.map(activity => {
                  const record     = schoolRecords.find(r =>
                    normalizeString(r.activity_name) === normalizeString(activity.name.split(' ')[0].trim()) &&
                    normalizeString(r.age_group)     === normalizeString(activity.age_group) &&
                    normalizeString(r.gender)        === normalizeString(activity.gender)
                  );
                  const resultCount = resultCounts[activity.id] || 0;
                  const isDone      = resultCount > 0;
                  return (
                    <div key={activity.id}
                      onClick={() => onSelectActivity({ id: activity.id, name: activity.name, type: activity.activity_type, scoringType: activity.scoring_type || 'metric', ageGroup: activity.age_group, gender: activity.gender, participantsPerHouse: activity.participants_per_house || 2 })}
                      className={`rounded-xl shadow-sm border p-5 cursor-pointer hover:shadow-md transition-all group relative overflow-hidden flex flex-col justify-between ${isDone ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-sky-400'}`}>
                      <div className={`absolute top-0 left-0 w-1 h-full ${isDone ? 'bg-emerald-500' : activity.activity_type === 'track' ? 'bg-sky-500' : activity.activity_type === 'field' ? 'bg-amber-500' : 'bg-purple-500'}`}/>
                      <div>
                        <div className="flex justify-between items-start mb-3 pl-2">
                          <span className="px-2 py-1 rounded text-xs font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">{activity.activity_type.replace('_', ' ')}</span>
                          <div className="flex items-center gap-1.5">
                            {isDone && (
                              <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 rounded-full">
                                <CheckCircle2 size={11}/> {resultCount} results
                              </span>
                            )}
                            <span className="text-xs font-bold bg-slate-800 dark:bg-slate-600 text-white px-2 py-1 rounded">{activity.age_group}</span>
                          </div>
                        </div>
                        <h3 className={`text-lg font-bold pl-2 transition-colors ${isDone ? 'text-emerald-800 dark:text-emerald-300' : 'text-slate-900 dark:text-white group-hover:text-sky-600'}`}>{activity.name}</h3>
                        <div className="flex items-center gap-1 mt-1 pl-2 text-slate-400 text-xs font-medium"><Users size={12}/> Top {activity.participants_per_house || 2} / House</div>
                      </div>
                      <div className="mt-3 pl-2 border-t border-slate-100 dark:border-slate-700 pt-3 flex items-center justify-between">
                        <span className={`text-sm font-semibold ${activity.gender === 'Boys' ? 'text-sky-600' : activity.gender === 'Girls' ? 'text-pink-600' : 'text-purple-600'}`}>{activity.gender}</span>
                        {record && <div className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/30 px-1.5 py-0.5 rounded truncate max-w-[120px]"><Medal size={10} className="shrink-0"/> {record.record_value}{activity.activity_type==='track'?'s':'m'}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}

      {mode === 'trials' && (
        <div className="space-y-5">
          {/* Session bucket selector */}
          {allTrials.length === 0 ? (
            <Card className="text-center py-10 text-slate-500">
              <ClipboardList size={36} className="mx-auto mb-3 text-slate-300"/>
              <p className="font-semibold">No trial sessions yet</p>
              <p className="text-sm mt-1">Ask your organiser to create a Trial Session bucket first.</p>
            </Card>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <label className="font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap text-sm">Session:</label>
                <div className="relative flex-1 max-w-sm">
                  <select value={selectedTrialId} onChange={(e) => setSelectedTrialId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-xl outline-none bg-white dark:bg-slate-700 dark:text-white font-medium shadow-sm appearance-none pr-8 text-sm">
                    {allTrials.map(t => <option key={t.id} value={t.id}>{t.name} ({t.trial_date})</option>)}
                  </select>
                  <ChevronDown className="absolute right-2 top-2.5 text-slate-500 pointer-events-none" size={16}/>
                </div>
              </div>

              {/* Start a new activity */}
              <Card>
                <h3 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2"><Plus size={16} className="text-purple-500"/> New Activity</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Activity Name <span className="text-red-400">*</span></label>
                    <input type="text" placeholder="e.g. 100m Sprint, High Jump, Discus..."
                      value={trialFilters.customActivityName} onChange={(e) => setTrialFilters({...trialFilters, customActivityName: e.target.value})}
                      className="w-full px-3 py-2.5 border border-slate-300 dark:border-slate-600 rounded-xl outline-none focus:ring-2 focus:ring-purple-400 bg-white dark:bg-slate-700 dark:text-white text-sm"/>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Measurement</label>
                    <select value={trialFilters.unit} onChange={(e) => setTrialFilters({...trialFilters, unit: e.target.value})}
                      className="w-full px-3 py-2.5 border border-slate-300 dark:border-slate-600 rounded-xl outline-none bg-white dark:bg-slate-700 dark:text-white text-sm">
                      <option value="seconds">Time (s)</option>
                      <option value="meters">Distance (m)</option>
                      <option value="cm">Height (cm)</option>
                    </select>
                  </div>
                </div>

                {/* Optional filters — collapsed by default */}
                <details className="group mb-4">
                  <summary className="cursor-pointer text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center gap-1.5 select-none list-none">
                    <ChevronRight size={13} className="group-open:rotate-90 transition-transform"/> Optional filters (age group, class, house, gender)
                  </summary>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Age Group</label>
                      <select value={trialFilters.ageGroup} onChange={(e) => setTrialFilters({...trialFilters, ageGroup: e.target.value})}
                        className="w-full px-2 py-2 border border-slate-300 dark:border-slate-600 rounded-lg outline-none bg-white dark:bg-slate-700 dark:text-white text-sm">
                        <option value="All">All Ages</option>
                        {['U10','U11','U12','U13','U14','U15','U16','U17','U18','U19','Open'].map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Gender</label>
                      <select value={trialFilters.gender} onChange={(e) => setTrialFilters({...trialFilters, gender: e.target.value})}
                        className="w-full px-2 py-2 border border-slate-300 dark:border-slate-600 rounded-lg outline-none bg-white dark:bg-slate-700 dark:text-white text-sm">
                        <option value="All">All</option><option value="Boys">Boys</option><option value="Girls">Girls</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Class</label>
                      <input type="text" placeholder="8A, 8B" value={trialFilters.className} onChange={(e) => setTrialFilters({...trialFilters, className: e.target.value})}
                        className="w-full px-2 py-2 border border-slate-300 dark:border-slate-600 rounded-lg outline-none focus:ring-2 focus:ring-purple-400 bg-white dark:bg-slate-700 dark:text-white text-sm"/>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">House</label>
                      <input type="text" placeholder="Disa, Red…" value={trialFilters.house === 'All' ? '' : trialFilters.house} onChange={(e) => setTrialFilters({...trialFilters, house: e.target.value || 'All'})}
                        className="w-full px-2 py-2 border border-slate-300 dark:border-slate-600 rounded-lg outline-none focus:ring-2 focus:ring-purple-400 bg-white dark:bg-slate-700 dark:text-white text-sm"/>
                    </div>
                  </div>
                </details>

                <Button onClick={handleStartTrial} variant="primary" className="w-full sm:w-auto" disabled={!trialFilters.customActivityName.trim()}>
                  <Activity size={16}/> Load Roster &amp; Start Scoring
                </Button>
              </Card>

              {/* Recent activities from this session */}
              {trialHistory.length > 0 && (
                <Card className="!p-0 overflow-hidden">
                  <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                    <h3 className="font-bold text-slate-800 dark:text-white text-sm flex items-center gap-2"><Clock size={15} className="text-purple-500"/> Continue a Previous Activity</h3>
                    <span className="text-xs text-slate-400">{trialHistory.length} recorded</span>
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-700">
                    {trialHistory.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-3 px-5 py-3 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors group">
                        {editingHistory && editingHistory.oldName === item.name ? (
                          <div className="flex items-center gap-2 flex-1" onClick={e => e.stopPropagation()}>
                            <input autoFocus type="text" value={editingHistory.newName} onChange={(e) => setEditingHistory({...editingHistory, newName: e.target.value})}
                              className="flex-1 px-2 py-1 text-sm border border-purple-300 rounded-lg outline-none dark:bg-slate-700 dark:text-white"/>
                            <button onClick={saveHistoryName} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"><CheckCircle2 size={16}/></button>
                            <button onClick={() => setEditingHistory(null)} className="p-1 text-slate-400 hover:bg-slate-100 rounded"><X size={16}/></button>
                          </div>
                        ) : (
                          <>
                            <button onClick={() => openHistorySession(item)} className="flex-1 flex items-center gap-3 text-left">
                              <div className="p-2 bg-purple-100 dark:bg-purple-900/40 rounded-lg shrink-0"><Activity size={14} className="text-purple-600 dark:text-purple-400"/></div>
                              <div>
                                <p className="font-semibold text-slate-800 dark:text-white text-sm group-hover:text-purple-700">{item.name}</p>
                                <p className="text-xs text-slate-400">{item.unit}</p>
                              </div>
                            </button>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={e => { e.stopPropagation(); setEditingHistory({ oldName: item.name, newName: item.name }); }}
                                className="p-1.5 text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded" title="Rename"><Edit size={13}/></button>
                              <button onClick={e => { e.stopPropagation(); setModalConfig({ isOpen: true, type: 'delete-history', payload: item }); }}
                                className="p-1.5 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded" title="Delete"><Trash2 size={13}/></button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

// --- STAFF DASHBOARD: SCORING VIEW ---
const StaffScoringView = ({ user, showToast, activity, houseColors, schoolRecords, onClose, refreshRecords }) => {
  const isTrial = activity.isTrial;

  const [studentRoster, setStudentRoster]   = useState([]);
  const [scores, setScores]                 = useState({});
  const [isLoading, setIsLoading]           = useState(true);
  const [isRefreshingRoster, setIsRefreshingRoster] = useState(false);
  const [isSaving, setIsSaving]             = useState(false);
  const [sortConfig, setSortConfig]         = useState({ key: 'last_name', direction: 'asc', secondaryKey: null });
  const [modalConfig, setModalConfig]       = useState({ isOpen: false, type: null, payload: null });
  const [eventAbsentees, setEventAbsentees] = useState([]);
  const [heatSize, setHeatSize]             = useState('All');
  const [manualHeats, setManualHeats]       = useState({});
  const [activeHeat, setActiveHeat]         = useState(1);
  const [savedHeats, setSavedHeats]         = useState(new Set());
  const [currentRecord, setCurrentRecord]   = useState(null);
  const [isEditingRecord, setIsEditingRecord] = useState(false);
  const [editableRecord, setEditableRecord] = useState({ value: '', holder: '' });
  const [kickedNamesCache, setKickedNamesCache] = useState({});
  const [timerSeconds, setTimerSeconds]     = useState(0);
  const [timerRunning, setTimerRunning]     = useState(false);
  const [timerPreset, setTimerPreset]       = useState(120);
  const [showFlagModal, setShowFlagModal]   = useState(false);
  const [flagType, setFlagType]             = useState('issue');
  const [flagMessage, setFlagMessage]       = useState('');
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (isTrial) { setCurrentRecord(null); return; }
    const matched = schoolRecords.find(r =>
      normalizeString(r.activity_name) === normalizeString(activity.name.trim()) &&
      normalizeString(r.age_group)     === normalizeString(activity.ageGroup) &&
      normalizeString(r.gender)        === normalizeString(activity.gender)
    );
    setCurrentRecord(matched || null);
  }, [schoolRecords, activity, isTrial]);

  const fetchRoster = useCallback(async (isRefresh = false) => {
    if (isRefresh) setIsRefreshingRoster(true); else setIsLoading(true);
    try {
      if (isTrial) {
        let query = supabase.from('students').select('*').eq('school_id', user.school_id);
        if (activity.filters.ageGroup !== 'All') query = query.eq('age_group', (activity.filters.ageGroup||'').replace(' (Open)','').trim());
        if (activity.filters.house   !== 'All') query = query.ilike('house', `%${activity.filters.house.trim()}%`);
        if (activity.filters.gender  !== 'All') query = query.eq('gender', activity.filters.gender);
        const { data: students } = await query;
        let filtered = students || [];
        if (activity.filters.className.trim() !== '') {
          const classList = activity.filters.className.split(',').map(c => c.trim().toLowerCase()).filter(Boolean);
          if (classList.length > 0) filtered = filtered.filter(s => classList.some(c => (s.class||'').toLowerCase().includes(c)));
        }
        if (activity.isHistory) {
          const { data: existing } = await supabase.from('trial_results').select('*, students(*)').eq('trial_id', activity.trialData.id).eq('activity_name', activity.filters.customActivityName);
          if (existing && existing.length > 0) {
            const loaded = {};
            const extras = [];
            existing.forEach(tr => {
              const sd = Array.isArray(tr.students) ? tr.students[0] : (tr.students || null);
              if (sd) { loaded[sd.id] = tr.result_value; if (!filtered.some(s => s.id === sd.id)) extras.push(sd); }
            });
            setStudentRoster([...filtered, ...extras]);
            if (!isRefresh) setScores(loaded);
          } else setStudentRoster(filtered);
        } else setStudentRoster(filtered);

      } else {
        const { data: absentees } = await supabase.from('event_absences').select('student_id, absence_status').eq('event_activity_id', activity.id);
        const absentList = (absentees || []).map(a => ({ id: a.student_id, status: a.absence_status || 'DNS' }));
        setEventAbsentees(absentList);
        const absentIds = absentList.map(a => a.id);

        let sQuery = supabase.from('students').select('*').eq('school_id', user.school_id)
          .eq('age_group', (activity.ageGroup||'').replace(' (Open)','').trim());
        if (activity.gender === 'Boys')  sQuery = sQuery.eq('gender', 'Boys');
        if (activity.gender === 'Girls') sQuery = sQuery.eq('gender', 'Girls');
        const { data: potential } = await sQuery;

        let matchName = activity.name.trim();
        if (matchName.toLowerCase().endsWith('s') && matchName.length > 3) matchName = matchName.slice(0, -1);
        // Scope to this school's trials only — prevents cross-school data leaking into roster
        const { data: schoolTrials } = await supabase.from('trials').select('id').eq('school_id', user.school_id);
        const schoolTrialIds = (schoolTrials || []).map(t => t.id);
        const { data: trialResults } = schoolTrialIds.length > 0
          ? await supabase.from('trial_results').select('*').ilike('activity_name', `%${matchName}%`).in('trial_id', schoolTrialIds)
          : { data: [] };

        const studentsByHouse = {};
        (potential || []).forEach(student => {
          if (absentIds.includes(student.id)) return;
          const house = student.house || 'Unassigned';
          if (!studentsByHouse[house]) studentsByHouse[house] = [];
          let best = null;
          if (trialResults && trialResults.length > 0) {
            const st = trialResults.filter(t => t.student_id === student.id);
            if (st.length > 0) best = activity.type === 'track' ? Math.min(...st.map(t => t.result_value)) : Math.max(...st.map(t => t.result_value));
          }
          studentsByHouse[house].push({ ...student, best_trial_score: best });
        });

        const limits = activity.participantsPerHouse || 2;
        let finalRoster = [];
        Object.keys(studentsByHouse).forEach(house => {
          let hs = studentsByHouse[house];
          hs.sort((a, b) => {
            if (a.best_trial_score === null && b.best_trial_score === null) return 0;
            if (a.best_trial_score === null) return 1;
            if (b.best_trial_score === null) return -1;
            return activity.type === 'track' ? a.best_trial_score - b.best_trial_score : b.best_trial_score - a.best_trial_score;
          });
          finalRoster = [...finalRoster, ...hs.slice(0, limits)];
        });
        setStudentRoster(finalRoster);

        const { data: existing } = await supabase.from('event_results').select('*').eq('event_activity_id', activity.id);
        if (existing && existing.length > 0) {
          const loaded = {};
          existing.forEach(r => { loaded[r.student_id] = r.result_value; });
          savedScoresRef.current = loaded;
          if (!isRefresh) setScores(loaded);
          else setScores(prev => ({ ...loaded, ...prev }));
        }
      }
    } catch (e) { console.error('Roster Fetch Error:', e); showToast('Failed to load roster.', 'error'); }
    finally { if (isRefresh) setIsRefreshingRoster(false); else setIsLoading(false); }
  }, [activity, user, isTrial]);

  useEffect(() => { fetchRoster(); }, [fetchRoster]);

  useEffect(() => {
    if (isTrial || eventAbsentees.length === 0) return;
    const unknown = eventAbsentees.filter(a => !kickedNamesCache[a.id]).map(a => a.id);
    if (unknown.length === 0) return;
    supabase.from('students').select('id, first_name, last_name').in('id', unknown).then(({ data }) => {
      if (data) {
        setKickedNamesCache(prev => {
          const next = { ...prev };
          data.forEach(s => { next[s.id] = s; });
          return next;
        });
      }
    });
  }, [eventAbsentees, activity, kickedNamesCache]);

  // Reset to heat 1 whenever heat size changes
  useEffect(() => { setActiveHeat(1); setSavedHeats(new Set()); setIsDirty(false); }, [heatSize]);

  // Countdown timer
  useEffect(() => {
    if (!timerRunning || timerSeconds <= 0) { if (timerSeconds <= 0) setTimerRunning(false); return; }
    const t = setTimeout(() => setTimerSeconds(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [timerRunning, timerSeconds]);

  useEffect(() => {
    if (heatSize === 'All') return;
    const size = parseInt(heatSize, 10);
    const sorted = [...studentRoster].sort((a, b) => {
      const vA = (a[sortConfig.key]||'').toString().toLowerCase();
      const vB = (b[sortConfig.key]||'').toString().toLowerCase();
      if (vA < vB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (vA > vB) return sortConfig.direction === 'asc' ?  1 : -1;
      return 0;
    });
    const newHeats = {};
    sorted.forEach((s, idx) => { newHeats[s.id] = Math.floor(idx / size) + 1; });
    setManualHeats(newHeats);
  }, [studentRoster, heatSize, sortConfig]);

  const requestSort = (key) => {
    setSortConfig(prev => ({ key, direction: prev.key === key ? (prev.direction === 'asc' ? 'desc' : 'asc') : 'asc', secondaryKey: key === 'last_name' ? null : 'last_name' }));
  };

  const moveStudentHeat = (id, dir) => setManualHeats(prev => {
    const next = (prev[id] || 1) + dir;
    if (next < 1) return prev;
    return { ...prev, [id]: next };
  });

  const sortedRoster = [...studentRoster].sort((a, b) => {
    const vA = (a[sortConfig.key]||'').toString().toLowerCase();
    const vB = (b[sortConfig.key]||'').toString().toLowerCase();
    if (vA < vB) return sortConfig.direction === 'asc' ? -1 : 1;
    if (vA > vB) return sortConfig.direction === 'asc' ?  1 : -1;
    if (sortConfig.secondaryKey) {
      const sA = (a[sortConfig.secondaryKey]||'').toString().toLowerCase();
      const sB = (b[sortConfig.secondaryKey]||'').toString().toLowerCase();
      if (sA < sB) return 1; if (sA > sB) return -1;
    }
    return 0;
  });

  let groupedRoster = { 1: sortedRoster };
  if (heatSize !== 'All') {
    groupedRoster = {};
    sortedRoster.forEach(s => {
      const h = manualHeats[s.id] || 1;
      if (!groupedRoster[h]) groupedRoster[h] = [];
      groupedRoster[h].push(s);
    });
  }
  const heatKeys = Object.keys(groupedRoster).sort((a, b) => parseInt(a) - parseInt(b));
  const orderedStudents = heatKeys.flatMap(h => groupedRoster[h]);

  const handleScoreChange = (id, val) => { setScores(prev => ({ ...prev, [id]: val })); setIsDirty(true); };

  const handleKeyDown = (e, nextId) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (nextId) { const el = document.getElementById(`score-input-${nextId}`); if (el) el.focus(); }
    else e.target.blur();
  };

  const executeKick = async (status = 'DNS') => {
    const studentId = modalConfig.payload;
    setModalConfig({ isOpen: false, type: null, payload: null });
    try {
      const { data: existing } = await supabase.from('event_absences').select('id').eq('event_activity_id', activity.id).eq('student_id', studentId).maybeSingle();
      let kickErr;
      if (existing) ({ error: kickErr } = await supabase.from('event_absences').update({ is_absent: true, absence_status: status }).eq('id', existing.id));
      else          ({ error: kickErr } = await supabase.from('event_absences').insert({ event_activity_id: activity.id, student_id: studentId, is_absent: true, absence_status: status }));
      if (kickErr) throw kickErr;
      setStudentRoster(prev => prev.filter(s => s.id !== studentId));
      setEventAbsentees(prev => [...prev, { id: studentId, status }]);
      showToast(`Marked as ${status}.`);
      fetchRoster(true);
    } catch (e) { showToast("Database error. Ensure 'event_absences' table exists.", 'error'); }
  };

  const executeUndoKick = async (studentId) => {
    try {
      const { error } = await supabase.from('event_absences').delete().eq('event_activity_id', activity.id).eq('student_id', studentId);
      if (error) throw error;
      setEventAbsentees(prev => prev.filter(a => a.id !== studentId));
      showToast('Student restored to roster.');
      fetchRoster(true);
    } catch (e) { showToast('Failed to restore student.', 'error'); }
  };

  const handleManualRecordUpdate = async () => {
    if (!editableRecord.value || !editableRecord.holder) return;
    const payload = { school_id: user.school_id, activity_name: activity.name.trim(), age_group: (activity.ageGroup||'').replace(/[\s/\\-]/g,''), gender: activity.gender, record_value: parseFloat(editableRecord.value), record_holder: editableRecord.holder };
    try {
      const { error } = await supabase.from('event_records').upsert(payload, { onConflict: 'school_id, activity_name, age_group, gender' });
      if (error) throw error;
      setCurrentRecord(payload); setIsEditingRecord(false);
      if (refreshRecords) refreshRecords();
      showToast('Record successfully updated!');
    } catch (e) { showToast('Failed to manually update record.', 'error'); }
  };

  const handleSaveResults = async () => {
    const withScores = Object.keys(scores).filter(id => scores[id] && scores[id].toString().trim() !== '');
    if (withScores.length === 0) { showToast('No scores entered.', 'error'); return; }
    setIsSaving(true);
    try {
      if (isTrial) {
        await supabase.from('trial_results').delete().eq('trial_id', activity.trialData.id).eq('activity_name', activity.filters.customActivityName).in('student_id', withScores);
        const rows = withScores.map(sid => ({ trial_id: activity.trialData.id, student_id: sid, activity_name: activity.filters.customActivityName, result_value: parseFloat(scores[sid]), unit: activity.filters.unit }));
        const { error: trialErr } = await supabase.from('trial_results').upsert(rows, { onConflict: 'trial_id, student_id, activity_name' });
        if (trialErr) throw trialErr;
        showToast(`Successfully saved ${rows.length} trial records!`);
      } else if (isPlacingMode) {
        const rows = withScores.map(sid => ({ event_activity_id: activity.id, student_id: sid, result_value: parseFloat(scores[sid]), recorded_by: user.id, is_new_record: false }));
        await supabase.from('event_results').upsert(rows, { onConflict: 'event_activity_id,student_id' });
        showToast(`Saved ${rows.length} placing results!`);
      } else {
        const isTrack = activity.type === 'track';
        let recordBrokenBy = null, newRecordValue = null;

        const rows = withScores.map(sid => {
          const score = parseFloat(scores[sid]);
          const oldRec = currentRecord ? parseFloat(currentRecord.record_value) : null;
          const breaksRecord = oldRec === null
            ? (newRecordValue === null || (isTrack ? score < newRecordValue : score > newRecordValue))
            : ((isTrack ? score < oldRec : score > oldRec) && (newRecordValue === null || (isTrack ? score < newRecordValue : score > newRecordValue)));

          if (breaksRecord) { newRecordValue = score; recordBrokenBy = sid; }
          return { event_activity_id: activity.id, student_id: sid, result_value: score, recorded_by: user.id, is_new_record: false };
        });

        // FIX: Set the record flag exactly once (removed the duplicate block that was below the upsert)
        // Save results first — only update the record if the save succeeds
        const { error: resultsErr } = await supabase.from('event_results').upsert(rows, { onConflict: 'event_activity_id,student_id' });
        if (resultsErr) throw resultsErr;

        if (recordBrokenBy) {
          rows.forEach(r => { if (r.student_id === recordBrokenBy) r.is_new_record = true; });
          // Write the updated flag back to the DB — the first upsert saved it as false
          await supabase.from('event_results').update({ is_new_record: true })
            .eq('event_activity_id', activity.id).eq('student_id', recordBrokenBy);
          const breaker = studentRoster.find(s => s.id === recordBrokenBy);
          const newRecPayload = { school_id: user.school_id, activity_name: activity.name.trim(), age_group: (activity.ageGroup||'').replace(/[\s/\\-]/g,''), gender: activity.gender, record_value: newRecordValue, record_holder: `${breaker.first_name} ${breaker.last_name} (${breaker.house})` };
          await supabase.from('event_records').upsert(newRecPayload, { onConflict: 'school_id, activity_name, age_group, gender' });
          showToast(`🏆 NEW RECORD! ${breaker.first_name} set a new record of ${newRecordValue}!`);
          setCurrentRecord(newRecPayload);
          if (refreshRecords) refreshRecords();
        } else {
          showToast(`Successfully saved ${rows.length} results!`);
        }
      }
    } catch (err) { console.error(err); showToast('Failed to save results. Check database schema.', 'error'); return; } finally { setIsSaving(false); }

    setIsDirty(false);

    // Advance to next heat automatically
    if (heatSize !== 'All') {
      setSavedHeats(prev => new Set([...prev, activeHeat]));
      const nextHeat = activeHeat + 1;
      if (groupedRoster[nextHeat]) {
        setActiveHeat(nextHeat);
        setTimerSeconds(timerPreset);
        setTimerRunning(true);
      }
    }
  };

  const handleFlagSubmit = async () => {
    if (!flagMessage.trim()) { showToast('Please describe the issue', 'error'); return; }
    try {
      await supabase.from('event_flags').insert({
        school_id: user.school_id, event_activity_id: activity.id,
        staff_id: user.id, message: flagMessage.trim(), flag_type: flagType, status: 'open',
      });
      showToast('Issue flagged to organiser');
    } catch {
      showToast('Could not send flag — check your connection', 'error');
    }
    setShowFlagModal(false); setFlagMessage(''); setFlagType('issue');
  };

  const handleClose = () => {
    if (isDirty) { setShowUnsavedWarning(true); return; }
    if (isTrial && activity.refreshHistoryCallback) activity.refreshHistoryCallback();
    onClose();
  };
  const confirmClose = () => {
    setShowUnsavedWarning(false);
    if (isTrial && activity.refreshHistoryCallback) activity.refreshHistoryCallback();
    onClose();
  };

  const isPlacingMode = !isTrial && activity.scoringType === 'placing';
  const isTrack = isTrial ? activity.filters.unit === 'seconds' : activity.type === 'track';
  const unitLabel = isPlacingMode ? 'Place' : isTrial ? (activity.filters.unit === 'seconds' ? 'Secs' : activity.filters.unit === 'cm' ? 'cm' : 'Meters') : (isTrack ? 'Secs' : 'Meters');
  const headerTitle = isTrial ? `${activity.trialData.name} - ${activity.filters.customActivityName}` : activity.name;
  const showHeatSplitter = (isTrial ? activity.filters.customActivityName : activity.name).toLowerCase().includes('100m');
  let subtitle = isTrial
    ? [activity.filters.ageGroup !== 'All' && activity.filters.ageGroup, activity.filters.className.trim() && `Class ${activity.filters.className}`, activity.filters.house !== 'All' && `House: ${activity.filters.house}`, activity.filters.gender !== 'All' && activity.filters.gender].filter(Boolean).join(' • ') + ' • PE Assessment'
    : `${activity.ageGroup} ${activity.gender} • ${activity.type.toUpperCase()}`;


  return (
    <div className="space-y-6 relative">
      <ConfirmModal
        isOpen={showUnsavedWarning}
        title="Unsaved Scores"
        message="You have scores that haven't been saved yet. Leave anyway?"
        confirmText="Leave"
        onConfirm={confirmClose}
        onCancel={() => setShowUnsavedWarning(false)}
      />
      {/* DNF/DNS/DQ status picker */}
      {modalConfig.isOpen && modalConfig.type === 'kick' && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-xs w-full border border-slate-200 dark:border-slate-700 p-6">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Mark Student Out</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">Choose a reason for removing this student from the roster.</p>
            <div className="grid grid-cols-3 gap-3 mb-5">
              {[['DNS','Did Not Start','slate'],['DNF','Did Not Finish','amber'],['DQ','Disqualified','purple']].map(([code, label, color]) => (
                <button key={code} onClick={() => executeKick(code)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 font-bold transition-colors
                    ${color === 'slate' ? 'border-slate-300 hover:border-slate-500 hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200' :
                      color === 'amber' ? 'border-amber-300 hover:border-amber-500 hover:bg-amber-50 dark:border-amber-700 dark:hover:bg-amber-900/20 text-amber-700 dark:text-amber-300' :
                      'border-purple-300 hover:border-purple-500 hover:bg-purple-50 dark:border-purple-700 dark:hover:bg-purple-900/20 text-purple-700 dark:text-purple-300'}`}>
                  <span className="text-lg font-black">{code}</span>
                  <span className="text-[10px] font-semibold text-center leading-tight opacity-70">{label}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setModalConfig({ isOpen: false, type: null, payload: null })}
              className="w-full py-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-medium">Cancel</button>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 pb-4 gap-4">
        <div className="flex items-center gap-4">
          <Button onClick={handleClose} variant="secondary" className="!px-3 !py-2"><ArrowLeft size={18}/></Button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">{headerTitle}</h2>
              <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${!isTrial ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' : 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300'}`}>{!isTrial ? 'Live Event' : 'Trial Data'}</span>
            </div>
            <div className="text-sm font-semibold mt-1 text-slate-600 dark:text-slate-400 flex items-center gap-2 flex-wrap">
              {subtitle}
              {!isTrial && (
                isEditingRecord ? (
                  <span className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/30 px-2 py-1 rounded border border-amber-200 dark:border-amber-700">
                    <input type="number" step="0.01" value={editableRecord.value} onChange={e => setEditableRecord({...editableRecord, value: e.target.value})} className="w-16 px-1 py-0.5 text-xs outline-none border border-amber-300 rounded bg-white dark:bg-slate-700 dark:text-white" placeholder="Val"/>
                    <input type="text"   value={editableRecord.holder} onChange={e => setEditableRecord({...editableRecord, holder: e.target.value})} className="w-32 px-1 py-0.5 text-xs outline-none border border-amber-300 rounded bg-white dark:bg-slate-700 dark:text-white" placeholder="Name"/>
                    <button onClick={handleManualRecordUpdate} className="text-emerald-600 hover:text-emerald-800"><CheckCircle2 size={14}/></button>
                    <button onClick={() => setIsEditingRecord(false)} className="text-red-500 hover:text-red-700"><X size={14}/></button>
                  </span>
                ) : currentRecord ? (
                  <span className="text-amber-600 dark:text-amber-400 font-bold bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-700 shadow-sm flex items-center gap-2 group/rec">
                    <span>🏆 Record: {currentRecord.record_value}{isTrack?'s':'m'} ({currentRecord.record_holder})</span>
                    <button onClick={() => { setEditableRecord({ value: currentRecord.record_value, holder: currentRecord.record_holder }); setIsEditingRecord(true); }} className="opacity-0 group-hover/rec:opacity-100 transition-opacity text-amber-500 hover:text-amber-700"><Edit size={12}/></button>
                  </span>
                ) : (
                  <span className="text-slate-400 dark:text-slate-500 font-bold bg-slate-50 dark:bg-slate-700 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-600 shadow-sm flex items-center gap-2 group/rec">
                    <span>No Record Set</span>
                    <button onClick={() => { setEditableRecord({ value: '', holder: '' }); setIsEditingRecord(true); }} className="opacity-0 group-hover/rec:opacity-100 transition-opacity text-slate-400 hover:text-slate-600"><Edit size={12}/></button>
                  </span>
                )
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* Flag issue button */}
          {!isTrial && (
            <button onClick={() => setShowFlagModal(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-900/50 border border-amber-200 dark:border-amber-700 transition-colors">
              <AlertCircle size={15}/> Flag Issue
            </button>
          )}
          {showHeatSplitter && (
            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600">
              <label className="text-sm font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap hidden sm:block">Heats:</label>
              <select value={heatSize} onChange={e => setHeatSize(e.target.value)} className="bg-transparent font-bold outline-none text-slate-900 dark:text-white cursor-pointer">
                <option value="All">No Split</option>
                <option value="4">4</option><option value="6">6</option><option value="8">8</option>
                <option value="10">10</option><option value="12">12</option>
              </select>
            </div>
          )}
          <Button onClick={handleSaveResults} variant="primary" disabled={isSaving || isLoading || studentRoster.length === 0}>
            {isSaving ? <><Loader2 className="animate-spin" size={18}/> Saving...</> : <><Save size={18}/> Save{heatSize !== 'All' ? ` Heat ${activeHeat}` : ''}</>}
          </Button>
        </div>
      </div>

      {/* Heat navigation bar */}
      {heatSize !== 'All' && heatKeys.length > 1 && (
        <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 rounded-xl px-4 py-3 border border-slate-200 dark:border-slate-700">
          <button onClick={() => { if (activeHeat > 1) { setActiveHeat(h => h - 1); setScores({}); setIsDirty(false); } }} disabled={activeHeat <= 1}
            className="p-2.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 text-slate-600 dark:text-slate-300 transition-colors"><ChevronLeft size={20}/></button>
          <div className="flex-1 flex items-center justify-center gap-2 flex-wrap">
            {heatKeys.map(h => {
              const num = parseInt(h);
              const done = savedHeats.has(num);
              const active = activeHeat === num;
              return (
                <button key={h} onClick={() => { setActiveHeat(num); setScores({}); setIsDirty(false); }}
                  className={`w-9 h-9 rounded-full text-sm font-bold transition-colors flex items-center justify-center
                    ${active ? 'bg-sky-500 text-white shadow-md' : done ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-700' : 'bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-300 border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600'}`}>
                  {done ? '✓' : num}
                </button>
              );
            })}
          </div>
          <button onClick={() => { const next = activeHeat + 1; if (groupedRoster[next]) { setActiveHeat(next); setScores({}); setIsDirty(false); } }} disabled={!groupedRoster[activeHeat + 1]}
            className="p-2.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 text-slate-600 dark:text-slate-300 transition-colors"><ChevronRight size={20}/></button>

          {/* Countdown timer */}
          <div className="ml-2 flex items-center gap-2 border-l border-slate-200 pl-3">
            {timerRunning || timerSeconds > 0 ? (
              <div className={`flex items-center gap-1.5 font-mono font-bold text-lg ${timerSeconds <= 30 ? 'text-red-500' : 'text-slate-700 dark:text-slate-200'}`}>
                <Timer size={16}/>
                {Math.floor(timerSeconds/60)}:{String(timerSeconds%60).padStart(2,'0')}
                <button onClick={() => { setTimerRunning(false); setTimerSeconds(0); }} className="text-slate-400 hover:text-slate-600 ml-1"><X size={14}/></button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <select value={timerPreset} onChange={e => setTimerPreset(parseInt(e.target.value))} className="text-xs bg-transparent outline-none text-slate-500 cursor-pointer">
                  <option value={60}>1 min</option>
                  <option value={120}>2 min</option>
                  <option value={180}>3 min</option>
                  <option value={300}>5 min</option>
                </select>
                <button onClick={() => { setTimerSeconds(timerPreset); setTimerRunning(true); }} className="flex items-center gap-1 text-xs text-slate-500 hover:text-sky-600 px-2 py-1 rounded hover:bg-sky-50 transition-colors">
                  <Timer size={14}/> Start
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <Card className="!p-0 overflow-hidden relative min-h-[300px]">
        {isLoading && !isRefreshingRoster ? (
          <div className="absolute inset-0 bg-white dark:bg-slate-800 flex items-center justify-center z-20"><Loader2 className="animate-spin text-blue-600" size={32}/></div>
        ) : (
          <>
            {isRefreshingRoster && <div className="absolute inset-0 bg-white/50 dark:bg-slate-800/50 backdrop-blur-[1px] flex items-center justify-center z-20"><Loader2 className="animate-spin text-blue-600" size={32}/></div>}
            {/* ── MOBILE card layout (hidden on md+) ── */}
            <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-700">
              {studentRoster.length === 0 ? (
                <p className="text-center py-12 text-slate-500 text-sm">{!isTrial ? 'No students qualify.' : 'No students found.'}</p>
              ) : (
                (heatSize !== 'All' ? [String(activeHeat)] : heatKeys).map(heatNum =>
                  groupedRoster[heatNum].map((student, index) => {
                    const vIdx = orderedStudents.findIndex(s => s.id === student.id);
                    const nextId = orderedStudents[vIdx + 1]?.id;
                    return (
                      <div key={student.id} className="flex items-center gap-3 px-4 py-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-900 dark:text-white text-sm truncate">{student.first_name} {student.last_name}</p>
                          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 flex items-center gap-1.5">
                            <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${getHouseColor(student.house, houseColors)}`}/>
                            {student.house || 'Unassigned'} · {student.class}
                            {!isTrial && student.best_trial_score != null && <span className="ml-1 text-amber-600 font-mono">Trial: {student.best_trial_score}</span>}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {isPlacingMode ? (
                            <div className="flex gap-1 flex-wrap justify-end max-w-[180px]">
                              {['1st','2nd','3rd','4th','5th','6th'].map((label, idx) => (
                                <button key={label} onClick={() => handleScoreChange(student.id, idx + 1)}
                                  className={`px-2 py-1.5 rounded-lg text-xs font-bold transition-colors touch-manipulation ${scores[student.id] == idx + 1 ? 'bg-sky-500 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                                  {label}
                                </button>
                              ))}
                              {scores[student.id] && <button onClick={() => handleScoreChange(student.id, '')} className="px-1.5 py-1.5 rounded-lg text-xs text-red-400 hover:bg-red-50 touch-manipulation">✕</button>}
                            </div>
                          ) : (
                            <input
                              id={`score-input-${student.id}`} type="number" inputMode="decimal" step="0.01"
                              value={scores[student.id] || ''} placeholder={isTrack ? '12.45' : '4.50'}
                              onChange={(e) => handleScoreChange(student.id, e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, nextId)}
                              className="w-24 px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-sky-400 outline-none text-right font-mono text-base bg-slate-50 dark:bg-slate-700 dark:text-white focus:bg-white dark:focus:bg-slate-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                          )}
                          {!isTrial && (
                            <button onClick={() => setModalConfig({ isOpen: true, type: 'kick', payload: student.id })}
                              className="p-1.5 text-slate-300 hover:text-red-500 transition-colors touch-manipulation">
                              <UserMinus size={16}/>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )
              )}
            </div>

            {/* ── DESKTOP table layout (hidden on mobile) ── */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-600">
                  <tr>
                    {heatSize !== 'All' && <th className="px-4 py-3 font-semibold w-16 text-center">Heat</th>}
                    <SortableHeader label="Student Name" sortKey="last_name" sortConfig={sortConfig} onSort={requestSort}/>
                    <SortableHeader label="Class" sortKey="class" sortConfig={sortConfig} onSort={requestSort}/>
                    {isTrial && <SortableHeader label="Age Group" sortKey="age_group" sortConfig={sortConfig} onSort={requestSort}/>}
                    <SortableHeader label="House" sortKey="house" sortConfig={sortConfig} onSort={requestSort}/>
                    {!isTrial && <th className="px-4 py-3 font-semibold text-center text-slate-400 text-xs">Trial Score</th>}
                    <th className="px-4 py-3 font-semibold w-48 text-right">Result ({unitLabel})</th>
                    {!isTrial && <th className="px-4 py-3 w-12"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {studentRoster.length === 0 ? (
                    <tr><td colSpan={10} className="text-center py-12 text-slate-500">{!isTrial ? 'No students qualify. Ensure trial data exists for this age group and activity name.' : 'No students found matching this criteria.'}</td></tr>
                  ) : (
                    (heatSize !== 'All' ? [String(activeHeat)] : heatKeys).map(heatNum => (
                      <React.Fragment key={`heat-${heatNum}`}>
                        {groupedRoster[heatNum].map((student, index) => {
                          const vIdx = orderedStudents.findIndex(s => s.id === student.id);
                          const nextId = orderedStudents[vIdx + 1]?.id;
                          let showSep = false, sepLabel = '';
                          if (heatSize === 'All' && index > 0 && !['last_name','first_name'].includes(sortConfig.key)) {
                            const prev = groupedRoster[heatNum][index - 1];
                            if (student[sortConfig.key] !== prev[sortConfig.key]) { showSep = true; sepLabel = student[sortConfig.key]; }
                          }
                          if (heatSize === 'All' && index === 0 && !['last_name','first_name'].includes(sortConfig.key)) { showSep = true; sepLabel = student[sortConfig.key]; }
                          return (
                            <React.Fragment key={student.id}>
                              {showSep && <tr className="bg-slate-100/80 dark:bg-slate-700/40"><td colSpan={10} className="px-4 py-1.5 font-bold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider border-y border-slate-200 dark:border-slate-600">{sortConfig.key.replace('_',' ')}: {sepLabel || 'Unassigned'}</td></tr>}
                              <tr className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group/row">
                                {heatSize !== 'All' && (
                                  <td className="px-4 py-2 align-middle border-r border-slate-100 dark:border-slate-700">
                                    <div className="flex flex-col items-center justify-center">
                                      <button onClick={() => moveStudentHeat(student.id, -1)} className="text-slate-300 hover:text-blue-600 p-0.5"><ChevronUp size={16}/></button>
                                      <span className="font-bold text-slate-500 text-xs">{manualHeats[student.id] || 1}</span>
                                      <button onClick={() => moveStudentHeat(student.id,  1)} className="text-slate-300 hover:text-blue-600 p-0.5"><ChevronDown size={16}/></button>
                                    </div>
                                  </td>
                                )}
                                <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{student.last_name}, {student.first_name}</td>
                                <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-medium">{student.class}</td>
                                {isTrial && <td className="px-4 py-3 text-slate-600 dark:text-slate-400 text-sm">{student.age_group}</td>}
                                <td className="px-4 py-3 text-slate-500 dark:text-slate-400"><span className={`inline-block w-2 h-2 rounded-full mr-2 ${getHouseColor(student.house, houseColors)}`}></span>{student.house || 'Unassigned'}</td>
                                {!isTrial && <td className="px-4 py-3 text-center text-slate-400 font-mono text-xs">{student.best_trial_score ?? '--'}</td>}
                                <td className="px-4 py-3 text-right">
                                  {isPlacingMode ? (
                                    <div className="flex gap-1.5 flex-wrap justify-end">
                                      {['1st','2nd','3rd','4th','5th','6th'].map((label, idx) => (
                                        <button key={label} onClick={() => handleScoreChange(student.id, idx + 1)}
                                          className={`px-3 py-2 rounded-lg text-sm font-bold transition-colors touch-manipulation ${scores[student.id] == idx + 1 ? 'bg-sky-500 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'}`}>
                                          {label}
                                        </button>
                                      ))}
                                      {scores[student.id] && (
                                        <button onClick={() => handleScoreChange(student.id, '')} className="px-2 py-2 rounded-lg text-sm text-red-400 hover:bg-red-50 touch-manipulation">✕</button>
                                      )}
                                    </div>
                                  ) : (
                                    <input
                                      id={`score-input-${student.id}`} type="number" inputMode="decimal" step="0.01"
                                      value={scores[student.id] || ''} placeholder={isTrack ? '12.45' : '4.50'}
                                      onChange={(e) => handleScoreChange(student.id, e.target.value)}
                                      onKeyDown={(e) => handleKeyDown(e, nextId)}
                                      className="w-full px-3 py-3 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-sky-400 outline-none text-right font-mono text-base bg-slate-50 dark:bg-slate-700 dark:text-white focus:bg-white dark:focus:bg-slate-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                  )}
                                </td>
                                {!isTrial && (
                                  <td className="px-4 py-3">
                                    <button onClick={() => setModalConfig({ isOpen: true, type: 'kick', payload: student.id })} title="Mark DNS/DNF/DQ" className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover/row:opacity-100">
                                      <UserMinus size={18}/>
                                    </button>
                                  </td>
                                )}
                              </tr>
                            </React.Fragment>
                          );
                        })}
                      </React.Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {!isTrial && eventAbsentees.length > 0 && (
              <div className="bg-red-50 dark:bg-red-900/20 border-t border-red-100 dark:border-red-900/40 p-3 text-xs flex flex-wrap gap-2 items-center">
                <span className="font-bold text-red-800 dark:text-red-300">Excluded:</span>
                {eventAbsentees.map(({ id, status }) => {
                  const s = kickedNamesCache[id] || { first_name: 'Unknown', last_name: 'Student' };
                  const statusColor = status === 'DQ' ? 'text-purple-600 border-purple-200 bg-white' : status === 'DNF' ? 'text-amber-600 border-amber-200 bg-white' : 'text-red-600 border-red-200 bg-white';
                  return (
                    <button key={id} onClick={() => executeUndoKick(id)} className={`flex items-center gap-1 border px-2 py-1 rounded hover:opacity-80 transition-colors ${statusColor}`} title="Tap to restore">
                      <UserPlus size={12}/> {s.first_name} {s.last_name.charAt(0) ? s.last_name.charAt(0)+'.' : ''} <span className="font-bold ml-0.5">· {status}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </Card>

      {/* Flag Issue Modal */}
      {showFlagModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-sm w-full border border-slate-200 dark:border-slate-700 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-xl"><AlertCircle size={20} className="text-amber-600"/></div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Flag an Issue</h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[['injury','Injury'],['equipment','Equipment'],['delay','Delay'],['issue','Other Issue']].map(([val, label]) => (
                <button key={val} onClick={() => setFlagType(val)}
                  className={`py-2.5 rounded-xl text-sm font-semibold border transition-colors ${flagType === val ? 'bg-amber-500 text-white border-amber-500' : 'bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-100'}`}>
                  {label}
                </button>
              ))}
            </div>
            <textarea value={flagMessage} onChange={e => setFlagMessage(e.target.value)} placeholder="Describe what's happening..." rows={3}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-xl outline-none focus:ring-2 focus:ring-amber-400 resize-none text-sm dark:bg-slate-700 dark:text-white"/>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => { setShowFlagModal(false); setFlagMessage(''); }} className="flex-1">Cancel</Button>
              <button onClick={handleFlagSubmit} className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm transition-colors">Send to Organiser</button>
            </div>
          </div>
        </div>
      )}

      {/* Sticky mobile save bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 px-4 py-3 flex items-center justify-between z-30 shadow-xl md:hidden">
        <div className="text-sm font-semibold text-slate-600 dark:text-slate-300">
          {heatSize !== 'All'
            ? <span>{savedHeats.size}/{heatKeys.length} heats done · Heat {activeHeat}</span>
            : <span>{Object.values(scores).filter(v => v !== '' && v != null).length} / {studentRoster.length} scored</span>}
        </div>
        <Button onClick={handleSaveResults} variant="primary" disabled={isSaving || isLoading || studentRoster.length === 0} className="!py-2.5 !px-5">
          {isSaving ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>}
          {isSaving ? 'Saving...' : heatSize !== 'All' ? `Save Heat ${activeHeat}` : 'Save All'}
        </Button>
      </div>
      {/* Bottom padding so sticky bar doesn't overlap content on mobile */}
      <div className="h-20 md:hidden"/>
    </div>
  );
};

// ==========================================
// 12. PARENT LIVE PORTAL
// FIX: Border-left color now uses getHouseColorHex() — Tailwind class strings
//      cannot be used as inline CSS values.
// FIX: Uses shared calculateStandings() instead of duplicate logic.
// ==========================================

const ParentPortal = ({ onNavigate }) => {
  const [accessCode, setAccessCode]           = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [recordsBoardEnabled, setRecordsBoardEnabled] = useState(false);
  const [activeEvent, setActiveEvent]         = useState(null);
  const [activeTab, setActiveTab]             = useState('standings');
  const [standings, setStandings]             = useState([]);
  const [recentResults, setRecentResults]     = useState([]);
  const [houseColors, setHouseColors]         = useState({});
  const [isLoading, setIsLoading]             = useState(false);
  const [errorMsg, setErrorMsg]               = useState('');

  // Child lookup state
  const [childSearch, setChildSearch]         = useState('');
  const [childResults, setChildResults]       = useState(null);
  const [isSearching, setIsSearching]         = useState(false);
  const [searchError, setSearchError]         = useState('');

  const handleVerifyCode = async (e) => {
    e.preventDefault(); setIsLoading(true); setErrorMsg('');
    try {
      const { data: rows, error } = await supabase.rpc('get_parent_portal_event', { p_access_code: accessCode.toUpperCase() });
      if (error || !rows || rows.length === 0) throw new Error('Invalid code or event is not active.');
      const row = rows[0];
      // Reconstruct the event shape the rest of the portal expects
      const eventObj = { id: row.event_id, name: row.event_name, event_date: row.event_date, school_id: row.school_id, is_active: true, parent_access_code: accessCode.toUpperCase() };
      const [{ data: hcData }, { data: schoolData }] = await Promise.all([
        supabase.from('school_houses').select('*').eq('school_id', row.school_id),
        supabase.from('schools').select('records_public').eq('id', row.school_id).maybeSingle(),
      ]);
      const map = {};
      (hcData || []).forEach(h => { map[h.house_name] = h.house_color; });
      setHouseColors(map);
      setRecordsBoardEnabled(schoolData?.records_public === true);
      setActiveEvent(eventObj); setIsAuthenticated(true);
    } catch (e) { setErrorMsg('Invalid code. Please check with your school.'); } finally { setIsLoading(false); }
  };

  const fetchLiveData = useCallback(async (eventId) => {
    try {
      const { data: activities } = await supabase.from('event_activities').select('id, name, activity_type, age_group, gender').eq('event_id', eventId);
      if (!activities || activities.length === 0) return;
      const { data: results } = await supabase.from('event_results').select('*, students(*)').in('event_activity_id', activities.map(a => a.id)).order('recorded_at', { ascending: false });
      if (!results) return;

      // FIX: Use shared calculateStandings — also mutates results with calculated_points
      const newStandings = calculateStandings(results, activities, houseColors);
      setStandings(newStandings);

      setRecentResults(results.slice(0, 15).map(r => {
        const act    = activities.find(a => a.id === r.event_activity_id);
        const suffix = act?.activity_type === 'track' ? 's' : 'm';
        const isPlacing = act?.activity_type === 'placing';
        const placing = isPlacing ? Math.round(r.result_value) : null;
        const podiumLabel = placing === 1 ? '🥇 1st' : placing === 2 ? '🥈 2nd' : placing === 3 ? '🥉 3rd' : null;
        let timeStr  = '';
        try { timeStr = new Date(r.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); } catch (e) { timeStr = 'Just now'; }
        const sd = (Array.isArray(r.students) ? r.students[0] : r.students) || {};
        const houseColorClass = getHouseColor(sd.house, houseColors);
        return {
          id:             r.id,
          event:          `${act?.age_group} ${act?.gender} ${act?.name}`,
          time:           timeStr,
          winner:         `${sd.first_name || 'Unknown'} ${sd.last_name?.charAt(0) ? sd.last_name.charAt(0)+'.' : ''}`,
          house:          sd.house || 'Unassigned',
          houseColorClass,
          houseColorHex:  getHouseColorHex(houseColorClass),
          metric:         isPlacing ? null : `${r.result_value}${suffix}`,
          podiumLabel,
          isRecord:       r.is_new_record,
          points:         r.calculated_points || 0,
        };
      }));
    } catch (e) { console.error('Live fetch error:', e); }
  }, [houseColors]);

  useEffect(() => {
    if (!isAuthenticated || !activeEvent) return;
    fetchLiveData(activeEvent.id);
    const interval = setInterval(() => fetchLiveData(activeEvent.id), 10000);
    return () => clearInterval(interval);
  }, [isAuthenticated, activeEvent, fetchLiveData]);

  const handleChildSearch = async (e) => {
    e.preventDefault();
    const term = childSearch.trim();
    if (term.length < 2) { setSearchError('Please enter at least 2 characters.'); return; }
    setIsSearching(true); setSearchError(''); setChildResults(null);
    try {
      // Find students in this event's school whose name matches
      const { data: activities } = await supabase.from('event_activities').select('id, name, activity_type, age_group, gender').eq('event_id', activeEvent.id);
      if (!activities || activities.length === 0) { setChildResults([]); return; }

      // Search students by name — only first+last name, no sensitive data exposed
      const { data: students } = await supabase.from('students')
        .select('id, first_name, last_name, house, age_group, gender')
        .eq('school_id', activeEvent.school_id)
        .or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%`);

      if (!students || students.length === 0) { setChildResults([]); return; }

      // For each matched student, find their results in this event
      const actIds = activities.map(a => a.id);
      const { data: results } = await supabase.from('event_results')
        .select('*')
        .in('event_activity_id', actIds)
        .in('student_id', students.map(s => s.id));

      const enriched = students.map(student => {
        const studentResults = (results || [])
          .filter(r => r.student_id === student.id)
          .map(r => {
            const act = activities.find(a => a.id === r.event_activity_id);
            const suffix = act?.activity_type === 'track' ? 's' : 'm';
            return {
              eventName: `${act?.age_group} ${act?.gender} ${act?.name}`,
              value: `${r.result_value}${suffix}`,
              isRecord: r.is_new_record,
              points: r.calculated_points || 0,
            };
          });
        return { ...student, results: studentResults };
      }).filter(s => s.results.length > 0 || students.length <= 3);

      setChildResults(enriched);
    } catch (e) {
      setSearchError('Search failed. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-slate-900 flex flex-col items-center justify-center p-4">
        <Card className="max-w-md w-full dark:bg-slate-800 dark:border-slate-700">
          <div className="text-center mb-6">
            <Trophy size={48} className="mx-auto text-sky-500 mb-4"/>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Live Spectator View</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">Enter the access code provided by your school.</p>
          </div>
          <form onSubmit={handleVerifyCode} className="space-y-4">
            {errorMsg && <div className="text-red-600 text-sm font-medium text-center bg-red-50 dark:bg-red-900/20 dark:text-red-400 p-2 rounded">{errorMsg}</div>}
            <input type="text" value={accessCode} onChange={(e) => setAccessCode(e.target.value)} placeholder="Enter Access Code" className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-sky-400 outline-none uppercase font-mono text-center tracking-widest text-lg" maxLength={10} required/>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? <Loader2 className="animate-spin mx-auto" size={20}/> : 'View Live Results'}
            </Button>
            <Button onClick={() => onNavigate('login')} variant="secondary" className="w-full">Back to Login</Button>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <header className="bg-sky-600 dark:bg-sky-700 text-white sticky top-0 z-10 shadow-md">
        <div className="p-4 max-w-3xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2"><Trophy size={20}/><h1 className="font-bold truncate max-w-[150px] sm:max-w-xs">{activeEvent?.name || 'Live Athletics'}</h1></div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-100 bg-emerald-800/40 px-2 py-1 rounded-full">
              <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span></span>
              Live Sync
            </div>
            <button onClick={() => setIsAuthenticated(false)} className="text-sm opacity-80 hover:opacity-100">Exit</button>
          </div>
        </div>
        <div className="flex border-t border-emerald-500/50 max-w-3xl mx-auto">
          <button onClick={() => setActiveTab('standings')} className={`flex-1 py-3 text-sm font-semibold text-center border-b-2 transition-colors ${activeTab === 'standings' ? 'border-white text-white' : 'border-transparent text-emerald-100/70 hover:text-white'}`}>Standings</button>
          <button onClick={() => setActiveTab('results')}   className={`flex-1 py-3 text-sm font-semibold text-center border-b-2 transition-colors ${activeTab === 'results'   ? 'border-white text-white' : 'border-transparent text-emerald-100/70 hover:text-white'}`}>Results</button>
          <button onClick={() => setActiveTab('child')}     className={`flex-1 py-3 text-sm font-semibold text-center border-b-2 transition-colors ${activeTab === 'child'     ? 'border-white text-white' : 'border-transparent text-emerald-100/70 hover:text-white'}`}>My Child</button>
          {recordsBoardEnabled && <button onClick={() => setActiveTab('records')} className={`flex-1 py-3 text-sm font-semibold text-center border-b-2 transition-colors ${activeTab === 'records' ? 'border-white text-white' : 'border-transparent text-sky-100/70 hover:text-white'}`}>🏅 Records</button>}
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 py-6 space-y-4">
        {activeTab === 'standings' && (
          <div className="space-y-3">
            {standings.length === 0 ? (
              <div className="text-center py-12 text-slate-500">Waiting for first results to calculate standings...</div>
            ) : standings.map((house, i) => (
              <div key={house.name} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-2xl font-bold text-slate-300 w-6">{i + 1}</span>
                  <div className={`w-4 h-12 rounded-full ${house.color}`}></div>
                  <span className="font-semibold text-lg text-slate-900">{house.name}</span>
                </div>
                <span className="text-3xl font-bold text-slate-800 tracking-tight">{house.points} <span className="text-sm text-slate-500 font-normal">pts</span></span>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'results' && (
          <div className="space-y-4">
            {recentResults.length === 0 ? (
              <div className="text-center py-12 text-slate-500">No results recorded yet.</div>
            ) : recentResults.map(result => (
              // FIX: Use houseColorHex (actual CSS hex value) for the inline border-left color
              <div key={result.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 border-l-4" style={{ borderLeftColor: result.houseColorHex }}>
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-slate-900">{result.event}</h3>
                  <span className="text-xs font-medium text-slate-400 flex items-center gap-1"><Clock size={12}/> {result.time}</span>
                </div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <Trophy size={16} className="text-amber-500"/>
                    <span className="font-medium text-slate-700">{result.winner}</span>
                    <span className="text-xs text-slate-500">({result.house})</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {result.points > 0 && <span className="text-xs font-bold text-sky-600 bg-sky-50 px-2 py-1 rounded">+{result.points} pts</span>}
                    {result.podiumLabel && <span className="font-bold px-2 py-1 rounded bg-amber-50 text-amber-800 text-sm">{result.podiumLabel}</span>}
                    {result.metric && <span className={`font-mono font-bold px-2 py-1 rounded text-sm ${result.isRecord ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-slate-100 text-slate-800'}`}>
                      {result.isRecord && <Medal size={12} className="inline mr-1 -mt-0.5 text-amber-500"/>}
                      {result.metric}
                    </span>}
                  </div>
                </div>
              </div>
            ))}
            <div className="text-center py-4">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider flex items-center justify-center gap-2">
                <Radio size={14} className="animate-pulse text-emerald-500"/> Auto-updating every 10s...
              </span>
            </div>
          </div>
        )}

        {activeTab === 'child' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <h2 className="font-bold text-slate-900 text-lg mb-1">Find My Child's Results</h2>
              <p className="text-sm text-slate-500 mb-4">Search by your child's first or last name to see their personal results for today's event.</p>
              <form onSubmit={handleChildSearch} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 text-slate-400" size={18}/>
                  <input
                    type="text"
                    value={childSearch}
                    onChange={e => { setChildSearch(e.target.value); setSearchError(''); setChildResults(null); }}
                    placeholder="e.g., Smith or Jason"
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <button type="submit" disabled={isSearching} className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2">
                  {isSearching ? <Loader2 className="animate-spin" size={18}/> : <Search size={18}/>}
                  Search
                </button>
              </form>
              {searchError && <p className="text-red-600 text-sm mt-2 flex items-center gap-1"><AlertCircle size={14}/> {searchError}</p>}
            </div>

            {childResults !== null && (
              childResults.length === 0 ? (
                <div className="text-center py-10 text-slate-500 bg-white rounded-xl border border-slate-200">
                  <Users size={36} className="mx-auto mb-3 text-slate-300"/>
                  <p className="font-semibold">No results found</p>
                  <p className="text-sm mt-1">No students matching that name have recorded results yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {childResults.map(student => (
                    <div key={student.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                      <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                        <div>
                          <h3 className="font-bold text-slate-900 text-lg">{student.first_name} {student.last_name}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs font-semibold text-slate-500 bg-slate-200 px-2 py-0.5 rounded">{student.age_group}</span>
                            <span className="text-xs font-semibold text-slate-500 bg-slate-200 px-2 py-0.5 rounded">{student.gender}</span>
                            <span className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded" style={{ backgroundColor: getHouseColorHex(getHouseColor(student.house, houseColors)) + '22', color: getHouseColorHex(getHouseColor(student.house, houseColors)) }}>
                              <span className={`w-2 h-2 rounded-full inline-block ${getHouseColor(student.house, houseColors)}`}></span>
                              {student.house || 'Unassigned'}
                            </span>
                          </div>
                        </div>
                        {student.results.length > 0 && (
                          <div className="text-right">
                            <p className="text-2xl font-black text-emerald-600">{student.results.reduce((sum, r) => sum + (r.points || 0), 0)}</p>
                            <p className="text-xs text-slate-500 font-semibold">total pts</p>
                          </div>
                        )}
                      </div>
                      {student.results.length === 0 ? (
                        <div className="p-4 text-sm text-slate-400 italic">No results recorded yet for this event.</div>
                      ) : (
                        <div className="divide-y divide-slate-100">
                          {student.results.map((r, i) => (
                            <div key={i} className="px-4 py-3 flex items-center justify-between">
                              <div>
                                <p className="font-semibold text-slate-800 text-sm">{r.eventName}</p>
                                {r.isRecord && <p className="text-xs text-amber-600 font-bold flex items-center gap-1 mt-0.5"><Medal size={12}/> New Record!</p>}
                              </div>
                              <div className="flex items-center gap-3">
                                {r.points > 0 && <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">+{r.points} pts</span>}
                                <span className={`font-mono font-bold px-3 py-1 rounded text-sm ${r.isRecord ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-slate-100 text-slate-900'}`}>{r.value}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        )}

        {activeTab === 'records' && recordsBoardEnabled && (
          <PublicRecordBoard schoolId={activeEvent.school_id}/>
        )}
      </main>
    </div>
  );
};

const PublicRecordBoard = ({ schoolId }) => {
  const [records, setRecords]   = useState([]);
  const [schools, setSchools]   = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterAge, setFilterAge] = useState('All');

  useEffect(() => {
    const fetch = async () => {
      const [{ data: recs }, { data: scs }] = await Promise.all([
        supabase.from('historical_records').select('*').order('activity_name').order('age_group'),
        supabase.from('schools').select('id, name'),
      ]);
      setRecords(recs || []);
      setSchools(scs || []);
      setIsLoading(false);
    };
    fetch();
  }, []);

  const schoolName = (id) => schools.find(s => s.id === id)?.name || 'Unknown';
  const ageGroups  = [...new Set(records.map(r => r.age_group))].sort();
  const filtered   = filterAge === 'All' ? records : records.filter(r => r.age_group === filterAge);
  const activities = [...new Set(filtered.map(r => r.activity_name))].sort();

  const map = {};
  filtered.forEach(r => {
    const key = `${r.activity_name}||${r.age_group}`;
    if (!map[key]) map[key] = [];
    map[key].push(r);
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-white/40" size={28}/></div>;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <h2 className="font-bold text-slate-900 text-lg mb-1">🏅 Records Board</h2>
        <p className="text-sm text-slate-500 mb-4">All-time records across participating schools.</p>
        <div className="flex flex-wrap gap-2">
          {['All', ...ageGroups].map(ag => (
            <button key={ag} onClick={() => setFilterAge(ag)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${filterAge === ag ? 'bg-sky-500 text-white' : 'bg-slate-100 text-slate-600'}`}>
              {ag}
            </button>
          ))}
        </div>
      </div>

      {activities.length === 0 ? (
        <div className="text-center py-10 text-white/60">No records have been posted yet.</div>
      ) : activities.map(activity => {
        const ageKeys = ageGroups.filter(ag => map[`${activity}||${ag}`]);
        return (
          <div key={activity} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 bg-slate-800 flex items-center gap-2">
              <Trophy size={14} className="text-amber-400"/>
              <span className="font-bold text-white text-sm">{activity}</span>
            </div>
            {ageKeys.map(ag => {
              const entries = (map[`${activity}||${ag}`] || []).sort((a, b) => b.record_value - a.record_value);
              const best = entries[0];
              return (
                <div key={ag} className="px-4 py-3 border-b border-slate-100 last:border-0 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{ag}</span>
                    <div>
                      <p className="font-bold text-slate-800 text-sm">{best.holder_name}</p>
                      <p className="text-xs text-slate-400">{schoolName(best.school_id)} · {best.record_year}</p>
                    </div>
                  </div>
                  <span className={`font-bold text-base ${best.school_id === schoolId ? 'text-amber-500' : 'text-slate-700'}`}>
                    {best.record_value} {best.school_id === schoolId && '★'}
                  </span>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

// ==========================================
// 13. SCHOOL REGISTRATION
// ==========================================
const SchoolRegistration = ({ onSuccess, onBack }) => {
  const [schoolName, setSchoolName]   = useState('');
  const [firstName, setFirstName]     = useState('');
  const [lastName, setLastName]       = useState('');
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [confirm, setConfirm]         = useState('');
  const [loading, setLoading]         = useState(false);
  const [errorMsg, setErrorMsg]       = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (password !== confirm) { setErrorMsg('Passwords do not match.'); return; }
    if (password.length < 8)  { setErrorMsg('Password must be at least 8 characters.'); return; }
    setLoading(true);
    let createdAuthId = null;
    let createdSchoolId = null;
    try {
      const { data: authData, error: authErr } = await supabase.auth.signUp({ email, password });
      if (authErr) throw authErr;
      if (!authData.user) throw new Error('Account creation failed. Please try again.');
      createdAuthId = authData.user.id;

      const { data: schoolData, error: schoolErr } = await supabase
        .from('schools').insert({ name: schoolName.trim() }).select().single();
      if (schoolErr) throw schoolErr;
      createdSchoolId = schoolData.id;

      const { error: userErr } = await supabase.from('users').insert({
        id: createdAuthId, school_id: createdSchoolId,
        email, first_name: firstName.trim(), last_name: lastName.trim(), role: 'organiser',
      });
      if (userErr) throw userErr;

      const { data: userData } = await supabase.from('users').select('*').eq('id', createdAuthId).single();
      onSuccess(userData);
    } catch (err) {
      // Clean up any partial inserts so there are no orphaned records
      if (createdSchoolId) await supabase.from('schools').delete().eq('id', createdSchoolId).catch(() => {});
      if (createdAuthId)   await supabase.auth.admin.deleteUser(createdAuthId).catch(() => {});
      setErrorMsg(err.message || 'Registration failed. Please try again.');
    } finally { setLoading(false); }
  };

  const Field = ({ label, type = 'text', value, onChange, placeholder }) => (
    <div>
      <label className="block text-sm font-semibold text-slate-700 mb-1.5">{label}</label>
      <input type={type} required value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-400 focus:border-transparent outline-none text-sm bg-slate-50 focus:bg-white transition-colors"/>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-sky-500 rounded-2xl shadow-lg shadow-sky-900/50 mb-3">
            <Trophy size={28} className="text-white"/>
          </div>
          <h1 className="text-2xl font-black text-white">Register Your School</h1>
          <p className="text-slate-400 text-sm mt-1">Get started with SportsDay Pro</p>
        </div>
        <div className="bg-white rounded-2xl shadow-2xl p-6 space-y-4">
          {errorMsg && (
            <div className="bg-red-50 text-red-700 p-3 rounded-xl text-sm flex items-center gap-2 border border-red-100">
              <AlertCircle size={15} className="shrink-0"/> {errorMsg}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-3">
            <Field label="School Name" value={schoolName} onChange={setSchoolName} placeholder="e.g., Sunridge Primary School"/>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Your First Name" value={firstName} onChange={setFirstName} placeholder="Jason"/>
              <Field label="Last Name"       value={lastName}  onChange={setLastName}  placeholder="Beckman"/>
            </div>
            <Field label="Email Address" type="email" value={email} onChange={setEmail} placeholder="you@school.edu"/>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Password"         type="password" value={password} onChange={setPassword} placeholder="Min 8 chars"/>
              <Field label="Confirm Password" type="password" value={confirm}  onChange={setConfirm}  placeholder="Repeat"/>
            </div>
            <div className="pt-1">
              <Button type="submit" className="w-full justify-center !py-3" disabled={loading}>
                {loading ? <><Loader2 className="animate-spin" size={16}/> Creating account...</> : 'Create School Account'}
              </Button>
            </div>
          </form>
          <button onClick={onBack} className="w-full text-sm text-slate-400 hover:text-slate-600 transition-colors py-1">
            Already have an account? Sign in
          </button>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 14. SUPER ADMIN PANEL
// ==========================================
// ─── RECORD BOARD ────────────────────────────────────────────────────────────
const AGE_GROUPS = ['U10', 'U11', 'U12', 'U13', 'U14', 'U15', 'U16', 'U17', 'U18'];

const RecordBoardModule = ({ user, showToast }) => {
  const [records, setRecords]         = useState([]);
  const [schools, setSchools]         = useState([]);
  const [isLoading, setIsLoading]     = useState(true);
  const [tab, setTab]                 = useState('board');   // 'board' | 'manage'
  const [showForm, setShowForm]       = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [filterAge, setFilterAge]     = useState('All');
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [form, setForm] = useState({ activity_name: '', age_group: 'U10', record_value: '', holder_name: '', record_year: new Date().getFullYear() });

  const fetchData = async () => {
    setIsLoading(true);
    const [{ data: recs }, { data: scs }] = await Promise.all([
      supabase.from('historical_records').select('*').order('activity_name').order('age_group'),
      supabase.from('schools').select('id, name'),
    ]);
    setRecords(recs || []);
    setSchools(scs || []);
    setIsLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const schoolName = (id) => schools.find(s => s.id === id)?.name || 'Unknown';
  const mySchoolId = user.school_id;

  // Group all records by activity then age group — keep only the best per slot across all schools
  const buildBoard = () => {
    const filtered = filterAge === 'All' ? records : records.filter(r => r.age_group === filterAge);
    const map = {};
    filtered.forEach(r => {
      const key = `${r.activity_name}||${r.age_group}`;
      if (!map[key]) map[key] = [];
      map[key].push(r);
    });
    // Sort each slot so lowest value is first (assumes lower = better for times; for distance higher = better — we'll show all entries ranked)
    const activities = [...new Set(filtered.map(r => r.activity_name))].sort();
    return { map, activities };
  };

  const { map, activities } = buildBoard();

  const openAdd = () => {
    setEditingRecord(null);
    setForm({ activity_name: '', age_group: 'U10', record_value: '', holder_name: '', record_year: new Date().getFullYear() });
    setShowForm(true);
  };

  const openEdit = (rec) => {
    setEditingRecord(rec);
    setForm({ activity_name: rec.activity_name, age_group: rec.age_group, record_value: rec.record_value, holder_name: rec.holder_name, record_year: rec.record_year });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.activity_name.trim() || !form.holder_name.trim() || !form.record_value) {
      showToast('Please fill in all fields', 'error'); return;
    }
    const payload = { ...form, record_value: parseFloat(form.record_value), school_id: mySchoolId };
    let error;
    if (editingRecord) {
      ({ error } = await supabase.from('historical_records').update(payload).eq('id', editingRecord.id));
    } else {
      ({ error } = await supabase.from('historical_records').insert(payload));
    }
    if (error) { showToast('Save failed: ' + error.message, 'error'); return; }
    showToast(editingRecord ? 'Record updated!' : 'Record added!');
    setShowForm(false);
    fetchData();
  };

  const handleDelete = (id) => setDeleteConfirmId(id);
  const confirmDelete = async () => {
    const id = deleteConfirmId;
    setDeleteConfirmId(null);
    const { error } = await supabase.from('historical_records').delete().eq('id', id);
    if (error) { showToast('Delete failed', 'error'); return; }
    showToast('Record removed');
    fetchData();
  };

  const myRecords = records.filter(r => r.school_id === mySchoolId);
  const ageGroups = [...new Set(records.map(r => r.age_group))].sort();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-5 border-b border-slate-100 dark:border-slate-700">
        <div>
          <div className="flex items-center gap-2">
            <Medal size={20} className="text-amber-500"/>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Records Board</h2>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">Manage your school's records. The public toggle in Super Admin only controls parent portal visibility — you can always manage records here.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setTab('board')} className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${tab === 'board' ? 'bg-sky-500 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'}`}>Board</button>
          <button onClick={() => setTab('manage')} className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${tab === 'manage' ? 'bg-sky-500 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'}`}>My School's Records</button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-slate-300" size={28}/></div>
      ) : tab === 'board' ? (
        <>
          {/* Age group filter */}
          <div className="flex items-center gap-2 flex-wrap">
            {['All', ...ageGroups].map(ag => (
              <button key={ag} onClick={() => setFilterAge(ag)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${filterAge === ag ? 'bg-amber-500 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'}`}>
                {ag}
              </button>
            ))}
          </div>

          {activities.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <Medal size={40} className="mx-auto mb-3 opacity-30"/>
              <p className="font-semibold">No records yet</p>
              <p className="text-sm mt-1">Schools can add their records from the "My School's Records" tab</p>
            </div>
          ) : (
            <div className="space-y-5">
              {activities.map(activity => {
                const ageKeys = ageGroups.filter(ag => map[`${activity}||${ag}`]);
                return (
                  <Card key={activity} className="!p-0 overflow-hidden">
                    <div className="px-6 py-3.5 bg-gradient-to-r from-slate-800 to-slate-700 dark:from-slate-700 dark:to-slate-600 flex items-center gap-2">
                      <Trophy size={15} className="text-amber-400"/>
                      <h3 className="font-bold text-white text-sm tracking-wide">{activity}</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-100 dark:border-slate-600 text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          <tr>
                            <th className="px-5 py-3 text-left font-semibold">Age Group</th>
                            <th className="px-5 py-3 text-left font-semibold">Record</th>
                            <th className="px-5 py-3 text-left font-semibold">Holder</th>
                            <th className="px-5 py-3 text-left font-semibold">School</th>
                            <th className="px-5 py-3 text-left font-semibold">Year</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                          {ageKeys.map(ag => {
                            const entries = (map[`${activity}||${ag}`] || []).sort((a, b) => b.record_value - a.record_value);
                            return entries.map((rec, i) => (
                              <tr key={rec.id} className={`transition-colors ${rec.school_id === mySchoolId ? 'bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100/60 dark:hover:bg-amber-900/30' : 'hover:bg-slate-50 dark:hover:bg-slate-700/30'}`}>
                                {i === 0 && (
                                  <td className="px-5 py-3.5 font-bold text-slate-700 dark:text-slate-300" rowSpan={entries.length}>
                                    <Badge color="blue">{ag}</Badge>
                                  </td>
                                )}
                                <td className="px-5 py-3.5">
                                  <div className="flex items-center gap-2">
                                    {i === 0 && <span className="text-amber-500">🥇</span>}
                                    {i === 1 && <span className="text-slate-400">🥈</span>}
                                    {i === 2 && <span className="text-amber-700">🥉</span>}
                                    <span className={`font-bold ${i === 0 ? 'text-amber-600 dark:text-amber-400 text-base' : 'text-slate-600 dark:text-slate-300'}`}>{rec.record_value}</span>
                                  </div>
                                </td>
                                <td className="px-5 py-3.5 text-slate-700 dark:text-slate-300 font-medium">{rec.holder_name}</td>
                                <td className="px-5 py-3.5">
                                  <span className={`text-sm font-semibold ${rec.school_id === mySchoolId ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'}`}>
                                    {schoolName(rec.school_id)} {rec.school_id === mySchoolId && '★'}
                                  </span>
                                </td>
                                <td className="px-5 py-3.5 text-slate-400 text-xs">{rec.record_year}</td>
                              </tr>
                            ));
                          })}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      ) : (
        /* ── MANAGE TAB ── */
        <>
          <div className="flex justify-between items-center">
            <p className="text-sm text-slate-500">{myRecords.length} record{myRecords.length !== 1 ? 's' : ''} from your school</p>
            <Button onClick={openAdd}><Plus size={16}/> Add Record</Button>
          </div>

          {myRecords.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <Medal size={40} className="mx-auto mb-3 opacity-30"/>
              <p className="font-semibold">No records added yet</p>
              <p className="text-sm mt-1">Click "Add Record" to start building your school's history</p>
            </div>
          ) : (
            <Card className="!p-0 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100 text-xs text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3 text-left font-semibold">Event</th>
                    <th className="px-5 py-3 text-left font-semibold">Age</th>
                    <th className="px-5 py-3 text-left font-semibold">Value</th>
                    <th className="px-5 py-3 text-left font-semibold">Holder</th>
                    <th className="px-5 py-3 text-left font-semibold">Year</th>
                    <th className="px-5 py-3"/>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {myRecords.map(rec => (
                    <tr key={rec.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3.5 font-semibold text-slate-800">{rec.activity_name}</td>
                      <td className="px-5 py-3.5"><Badge color="blue">{rec.age_group}</Badge></td>
                      <td className="px-5 py-3.5 font-bold text-amber-600">{rec.record_value}</td>
                      <td className="px-5 py-3.5 text-slate-600">{rec.holder_name}</td>
                      <td className="px-5 py-3.5 text-slate-400 text-xs">{rec.record_year}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2 justify-end">
                          <button onClick={() => openEdit(rec)} className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors"><Edit size={14}/></button>
                          <button onClick={() => handleDelete(rec.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={14}/></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </>
      )}

      {/* ── ADD / EDIT FORM MODAL ── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="px-6 pt-6 pb-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900">{editingRecord ? 'Edit Record' : 'Add Record'}</h3>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={18}/></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Event / Activity Name</label>
                <input value={form.activity_name} onChange={e => setForm(f => ({ ...f, activity_name: e.target.value }))}
                  placeholder="e.g. 100m Sprint"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"/>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Age Group</label>
                  <select value={form.age_group} onChange={e => setForm(f => ({ ...f, age_group: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400">
                    {AGE_GROUPS.map(ag => <option key={ag}>{ag}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Record Value</label>
                  <input type="number" step="0.01" value={form.record_value} onChange={e => setForm(f => ({ ...f, record_value: e.target.value }))}
                    placeholder="e.g. 12.45"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"/>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Record Holder Name</label>
                <input value={form.holder_name} onChange={e => setForm(f => ({ ...f, holder_name: e.target.value }))}
                  placeholder="e.g. Jane Smith (Eagle House)"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"/>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Year Set</label>
                <input type="number" value={form.record_year} onChange={e => setForm(f => ({ ...f, record_year: parseInt(e.target.value) }))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"/>
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
              <button onClick={handleSave} className="flex-1 py-2.5 rounded-xl bg-sky-500 text-white text-sm font-semibold hover:bg-sky-600 transition-colors">Save Record</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!deleteConfirmId}
        title="Delete Record"
        message="Delete this record permanently? This cannot be undone."
        confirmText="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirmId(null)}
      />
    </div>
  );
};

const SuperAdminPanel = ({ user, onBack }) => {
  const [schools, setSchools]         = useState([]);
  const [isLoading, setIsLoading]     = useState(true);
  const [allUsers, setAllUsers]       = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  const [allEvents, setAllEvents]     = useState([]);
  const [expandedSchool, setExpandedSchool] = useState(null);
  const [recordsPublic, setRecordsPublic] = useState(false);

  useEffect(() => {
    supabase.from('schools').select('records_public').eq('id', allSchools[0]?.id ?? '').maybeSingle()
      .then(({ data }) => { if (data) setRecordsPublic(data.records_public); });
  }, [allSchools]);

  const toggleRecordsBoard = async () => {
    const next = !recordsPublic;
    setRecordsPublic(next);
    await supabase.from('schools').update({ records_public: next }).eq('id', allSchools[0]?.id ?? '');
  };

  useEffect(() => {
    const fetchAll = async () => {
      setIsLoading(true);
      try {
        const [{ data: sc }, { data: us }, { data: st }, { data: ev }] = await Promise.all([
          supabase.from('schools').select('*').order('created_at', { ascending: false }),
          supabase.from('users').select('id, school_id, role, email, first_name, last_name'),
          supabase.from('students').select('id, school_id'),
          supabase.from('events').select('id, school_id, name, event_date, is_active').order('event_date', { ascending: false }),
        ]);
        setSchools(sc || []); setAllUsers(us || []);
        setAllStudents(st || []); setAllEvents(ev || []);
      } catch (e) { console.error(e); } finally { setIsLoading(false); }
    };
    fetchAll();
  }, []);

  const liveEvents    = allEvents.filter(e => e.is_active);
  const totalStudents = allStudents.length;
  const totalSchools  = schools.length;
  const totalUsers    = allUsers.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 pb-5 border-b border-slate-100">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
          <ArrowLeft size={20}/>
        </button>
        <div>
          <div className="flex items-center gap-2">
            <Shield size={20} className="text-purple-600"/>
            <h2 className="text-xl font-bold text-slate-900">Platform Overview</h2>
            <Badge color="purple">Super Admin</Badge>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">All schools and activity across SportsDay Pro</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Building2} label="Schools"        value={totalSchools}  color="purple"/>
        <StatCard icon={Users}     label="Total Users"    value={totalUsers}    color="blue"/>
        <StatCard icon={Activity}  label="Total Students" value={totalStudents} color="emerald"/>
        <StatCard icon={Trophy}    label="Total Events"   value={allEvents.length} color="amber"/>
      </div>

      {/* Platform feature toggles */}
      <Card>
        <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2"><Settings size={16} className="text-slate-500"/> Feature Flags</h3>
        <div className="flex items-center justify-between py-3 border-b border-slate-100">
          <div>
            <p className="font-semibold text-slate-800 text-sm">Inter-School Records Board</p>
            <p className="text-xs text-slate-500 mt-0.5">Show the public Records tab in the parent portal. Enable once multiple schools are live.</p>
          </div>
          <button
            onClick={toggleRecordsBoard}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${recordsPublic ? 'bg-sky-500' : 'bg-slate-200'}`}>
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${recordsPublic ? 'translate-x-6' : 'translate-x-1'}`}/>
          </button>
        </div>
      </Card>

      {/* Live right now */}
      {liveEvents.length > 0 && (
        <div className="bg-sky-50 border border-sky-100 rounded-2xl p-5">
          <h3 className="font-bold text-sky-900 flex items-center gap-2 mb-3">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"/>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-sky-500"/>
            </span>
            Live Right Now — {liveEvents.length} active event{liveEvents.length > 1 ? 's' : ''}
          </h3>
          <div className="space-y-2">
            {liveEvents.map(ev => {
              const school = schools.find(s => s.id === ev.school_id);
              return (
                <div key={ev.id} className="flex items-center justify-between bg-white rounded-xl px-4 py-3 border border-sky-100">
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">{ev.name}</p>
                    <p className="text-xs text-slate-400">{school?.name || 'Unknown School'}</p>
                  </div>
                  <Badge color="sky">{ev.event_date}</Badge>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Schools table */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-slate-300" size={28}/></div>
      ) : (
        <Card className="!p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-900">Registered Schools</h3>
            <p className="text-sm text-slate-400">Click a school to see its users</p>
          </div>
          <div className="divide-y divide-slate-50">
            {schools.map(school => {
              const schoolUsers   = allUsers.filter(u => u.school_id === school.id);
              const organisers    = schoolUsers.filter(u => u.role === 'organiser');
              const staff         = schoolUsers.filter(u => u.role === 'staff');
              const studentCount  = allStudents.filter(s => s.school_id === school.id).length;
              const schoolEvents  = allEvents.filter(e => e.school_id === school.id);
              const activeCount   = schoolEvents.filter(e => e.is_active).length;
              const isExpanded    = expandedSchool === school.id;

              return (
                <div key={school.id}>
                  <button
                    onClick={() => setExpandedSchool(isExpanded ? null : school.id)}
                    className="w-full text-left hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-4 px-6 py-4">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center text-white font-bold flex-shrink-0">
                        {(school.name || '?')[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-slate-900">{school.name}</p>
                          {activeCount > 0 && (
                            <span className="flex items-center gap-1 text-xs text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block"/> {activeCount} live
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400">{organisers[0]?.email || 'No organiser'}</p>
                      </div>
                      <div className="hidden md:flex items-center gap-6 text-sm">
                        <div className="text-center"><p className="font-bold text-slate-700">{studentCount}</p><p className="text-xs text-slate-400">students</p></div>
                        <div className="text-center"><p className="font-bold text-slate-700">{schoolEvents.length}</p><p className="text-xs text-slate-400">events</p></div>
                        <div className="text-center"><p className="font-bold text-slate-700">{schoolUsers.length}</p><p className="text-xs text-slate-400">users</p></div>
                      </div>
                      <ChevronDown size={16} className={`text-slate-400 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}/>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-6 pb-5 bg-slate-50 border-t border-slate-100">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                        {/* Users */}
                        <div>
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Users</p>
                          <div className="space-y-2">
                            {schoolUsers.length === 0 ? (
                              <p className="text-sm text-slate-400 italic">No users yet</p>
                            ) : schoolUsers.map(u => (
                              <div key={u.id} className="flex items-center gap-2.5 bg-white rounded-xl px-3 py-2 border border-slate-100">
                                <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs flex-shrink-0">
                                  {(u.first_name || '?')[0].toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-slate-800 truncate">{u.first_name} {u.last_name}</p>
                                  <p className="text-xs text-slate-400 truncate">{u.email}</p>
                                </div>
                                <Badge color={u.role === 'organiser' ? 'blue' : u.role === 'super_admin' ? 'purple' : 'slate'}>{u.role}</Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                        {/* Events */}
                        <div>
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Events</p>
                          <div className="space-y-2">
                            {schoolEvents.length === 0 ? (
                              <p className="text-sm text-slate-400 italic">No events yet</p>
                            ) : schoolEvents.slice(0, 5).map(ev => (
                              <div key={ev.id} className="flex items-center justify-between bg-white rounded-xl px-3 py-2 border border-slate-100">
                                <div>
                                  <p className="text-sm font-semibold text-slate-800">{ev.name}</p>
                                  <p className="text-xs text-slate-400">{ev.event_date}</p>
                                </div>
                                <Badge color={ev.is_active ? 'emerald' : 'slate'}>{ev.is_active ? 'Live' : 'Archived'}</Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
};

// ==========================================
// 15. LOGIN VIEW
// ==========================================

const LoginView = ({ onLogin, onNavigate }) => {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true); setErrorMsg('');
    try {
      const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({ email, password });
      if (authErr) throw authErr;
      const { data: userData, error: userErr } = await supabase.from('users').select('*').eq('id', auth.user.id).single();
      if (userErr) throw userErr;
      onLogin(userData);
    } catch (err) { setErrorMsg(err.message || 'Authentication failed. Please check your credentials.'); } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-sky-500 rounded-2xl shadow-lg shadow-sky-900/50 mb-4">
            <Trophy size={32} className="text-white"/>
          </div>
          <h1 className="text-3xl font-black text-white">SportsDay Pro</h1>
          <p className="text-slate-400 mt-2 text-sm">Run your school sports day with confidence</p>
        </div>
        <div className="bg-white rounded-2xl shadow-2xl p-6 space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMsg && (
              <div className="bg-red-50 text-red-700 p-3 rounded-xl text-sm flex items-center gap-2 border border-red-100">
                <AlertCircle size={16} className="shrink-0"/> {errorMsg}
              </div>
            )}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email Address</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-400 focus:border-transparent outline-none text-sm bg-slate-50 focus:bg-white transition-colors"
                placeholder="you@school.edu"/>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Password</label>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-400 focus:border-transparent outline-none text-sm bg-slate-50 focus:bg-white transition-colors"
                placeholder="••••••••"/>
            </div>
            <Button type="submit" className="w-full justify-center !py-3" disabled={loading}>
              {loading ? <Loader2 className="animate-spin" size={18}/> : 'Sign In Securely'}
            </Button>
          </form>
          <div className="relative my-2"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"/></div><div className="relative flex justify-center"><span className="bg-white px-3 text-xs text-slate-400 font-medium">OR</span></div></div>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => onNavigate('parent')}
              className="flex items-center justify-center gap-2 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 font-semibold text-sm transition-colors border border-slate-200">
              <Smartphone size={16}/> Parent Portal
            </button>
            <button onClick={() => onNavigate('register')}
              className="flex items-center justify-center gap-2 p-3 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-600 font-semibold text-sm transition-colors border border-sky-100">
              <Plus size={16}/> Register School
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 14. ROOT APP + ROUTER
// FIX: Session persistence on page load
// FIX: Mobile nav for organiser portal
// FIX: Print CSS injected via <style> tag
// ==========================================

// Shared nav item list to avoid duplication between desktop sidebar and mobile drawer
const ORGANISER_NAV = [
  { view: 'dashboard',   icon: Activity,      label: 'Dashboard'      },
  { view: 'event-setup', icon: Settings,      label: 'Events'         },
  { view: 'trial-setup', icon: ClipboardList, label: 'Trials'         },
  { view: 'students',    icon: Users,         label: 'Directory'      },
  { view: 'houses',      icon: Palette,       label: 'Houses'         },
  { view: 'standings',   icon: Trophy,        label: 'Live Standings' },
  { view: 'records',     icon: Medal,         label: 'Records'        },
  { view: 'flags',       icon: AlertCircle,   label: 'Staff Flags'    },
];

// Hash routing — maps URL hash ↔ app route/view
const VIEW_TO_HASH = {
  'dashboard':   '#/organiser',
  'event-setup': '#/organiser/events',
  'trial-setup': '#/organiser/trials',
  'students':    '#/organiser/directory',
  'houses':      '#/organiser/houses',
  'standings':   '#/organiser/standings',
  'records':     '#/organiser/records',
  'flags':       '#/organiser/flags',
};
const HASH_TO_NAV = {
  '#/organiser':           { route: 'organiser-dashboard', view: 'dashboard'   },
  '#/organiser/events':    { route: 'organiser-dashboard', view: 'event-setup' },
  '#/organiser/trials':    { route: 'organiser-dashboard', view: 'trial-setup' },
  '#/organiser/directory': { route: 'organiser-dashboard', view: 'students'    },
  '#/organiser/houses':    { route: 'organiser-dashboard', view: 'houses'      },
  '#/organiser/standings': { route: 'organiser-dashboard', view: 'standings'   },
  '#/organiser/records':   { route: 'organiser-dashboard', view: 'records'     },
  '#/organiser/flags':     { route: 'organiser-dashboard', view: 'flags'       },
  '#/staff':               { route: 'staff-dashboard',     view: null           },
  '#/admin':               { route: 'super-admin',         view: null           },
  '#/parent':              { route: 'parent',              view: null           },
  '#/register':            { route: 'register',            view: null           },
};

export default function App() {
  const [user, setUser]                   = useState(null);
  const [currentRoute, setCurrentRoute]   = useState('login');
  const [organiserView, setOrganiserView] = useState('dashboard');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [toastConfig, setToastConfig]     = useState(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [darkMode, setDarkMode]           = useState(() => localStorage.getItem('sdp-dark') === 'true');
  const [showChangePw, setShowChangePw]   = useState(false);
  const [openFlagCount, setOpenFlagCount] = useState(0);

  useEffect(() => {
    if (darkMode) { document.documentElement.classList.add('dark'); }
    else          { document.documentElement.classList.remove('dark'); }
    localStorage.setItem('sdp-dark', darkMode);
  }, [darkMode]);

  // Sync hash → URL whenever route/view changes
  useEffect(() => {
    if (currentRoute === 'organiser-dashboard') {
      window.location.hash = VIEW_TO_HASH[organiserView] || '#/organiser';
    } else if (currentRoute === 'staff-dashboard') {
      window.location.hash = '#/staff';
    } else if (currentRoute === 'super-admin') {
      window.location.hash = '#/admin';
    } else if (currentRoute === 'parent') {
      window.location.hash = '#/parent';
    } else if (currentRoute === 'register') {
      window.location.hash = '#/register';
    } else {
      window.location.hash = '';
    }
  }, [currentRoute, organiserView]);

  // FIX: Restore session on page reload, then apply hash routing
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const { data: userData } = await supabase.from('users').select('*').eq('id', session.user.id).single();
          if (userData) {
            setUser(userData);
            const isAdmin = ['organiser', 'super_admin'].includes(userData.role);
            // Try to restore the hash-encoded view
            const nav = HASH_TO_NAV[window.location.hash];
            if (nav && ((isAdmin && nav.route !== 'staff-dashboard') || (!isAdmin && nav.route === 'staff-dashboard'))) {
              setCurrentRoute(nav.route);
              if (nav.view) setOrganiserView(nav.view);
            } else {
              setCurrentRoute(isAdmin ? 'organiser-dashboard' : 'staff-dashboard');
            }
          }
        }
      } catch (e) {
        // No valid session — stay on login screen
      } finally {
        setSessionChecked(true);
      }
    };
    checkSession();
  }, []);

  // Poll open flag count so sidebar badge stays current
  useEffect(() => {
    if (!user || !['organiser', 'super_admin'].includes(user.role)) return;
    const fetchFlagCount = async () => {
      const { count } = await supabase.from('event_flags').select('id', { count: 'exact', head: true })
        .eq('school_id', user.school_id).eq('status', 'open');
      setOpenFlagCount(count || 0);
    };
    fetchFlagCount();
    const interval = setInterval(fetchFlagCount, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const showToast = (msg, type = 'success') => {
    setToastConfig({ msg, type });
    setTimeout(() => setToastConfig(null), 3000);
  };

  const handleLogin = (userData) => {
    setUser(userData);
    setOrganiserView('dashboard');
    const isAdmin = ['organiser', 'super_admin'].includes(userData.role);
    setCurrentRoute(isAdmin ? 'organiser-dashboard' : 'staff-dashboard');
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setCurrentRoute('login');
    window.location.hash = '';
  };

  // Don't render until we've checked for an existing session to prevent a flash of login screen
  if (!sessionChecked) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-sky-500" size={36}/>
      </div>
    );
  }

  const isSuperAdmin = user?.role === 'super_admin';

  const NavItems = ({ onNavigate }) => (
    <>
      {ORGANISER_NAV.map(({ view, icon: Icon, label }) => {
        const isActive = organiserView === view;
        return (
          <button key={view}
            onClick={() => { setOrganiserView(view); if (onNavigate) onNavigate(); }}
            className={`w-full px-3 py-2.5 rounded-xl flex items-center gap-3 transition-all text-sm font-medium ${
              isActive
                ? 'bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 font-semibold'
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-800 dark:hover:text-slate-200'
            }`}>
            <Icon size={18}/> {label}
            {view === 'flags' && openFlagCount > 0 && (
              <span className="ml-auto bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full leading-none">{openFlagCount}</span>
            )}
            {isActive && view !== 'flags' && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-sky-500"/>}
            {isActive && view === 'flags' && openFlagCount === 0 && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-sky-500"/>}
          </button>
        );
      })}
      {isSuperAdmin && (
        <button
          onClick={() => { setCurrentRoute('super-admin'); if (onNavigate) onNavigate(); }}
          className="w-full px-3 py-2.5 rounded-xl flex items-center gap-3 transition-all text-sm font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-800 dark:hover:text-slate-200 mt-2 pt-4 border-t border-slate-200 dark:border-slate-700">
          <Shield size={18}/> Super Admin
        </button>
      )}
    </>
  );

  return (
    <>
      {/* FIX: Print styles injected directly so they work without a separate stylesheet */}
      <style>{`
        @media print {
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          @page { size: A4 portrait; margin: 16mm 14mm; }
          body { background: white !important; color: black !important; font-family: system-ui, sans-serif; }
          .hide-on-print   { display: none !important; }
          .print-header    { display: block !important; }
          .print-only      { display: block !important; }
          .screen-only     { display: none !important; }
          .print-full-width { width: 100% !important; max-width: 100% !important; }
          .print-container { padding: 0 !important; }
          aside, nav       { display: none !important; }
          .print-page-break { page-break-before: always; }
          .print-avoid-break { page-break-inside: avoid; }
        }
        .print-only { display: none; }
      `}</style>

      <Toast toast={toastConfig}/>

      {currentRoute === 'login'    && <LoginView onLogin={handleLogin} onNavigate={setCurrentRoute}/>}
      {currentRoute === 'parent'   && <ParentPortal onNavigate={setCurrentRoute}/>}
      {currentRoute === 'register' && <SchoolRegistration onSuccess={handleLogin} onBack={() => setCurrentRoute('login')}/>}
      {currentRoute === 'super-admin' && user && (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex">
          <aside className="w-56 bg-white dark:bg-slate-800 flex-col hidden md:flex flex-shrink-0 border-r border-slate-200 dark:border-slate-700">
            <div className="p-5 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-sky-500 rounded-xl"><Trophy size={18} className="text-white"/></div>
                <span className="font-bold text-slate-800 text-base tracking-tight">SportsDay Pro</span>
              </div>
            </div>
            <nav className="flex-1 p-3 space-y-1">
              <button onClick={() => setCurrentRoute('organiser-dashboard')} className="w-full px-3 py-2.5 rounded-xl flex items-center gap-3 text-slate-500 hover:bg-slate-100 hover:text-slate-800 text-sm font-medium transition-all">
                <ArrowLeft size={18}/> Back to Dashboard
              </button>
            </nav>
            <div className="p-3 border-t border-slate-200">
              <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-100 rounded-xl text-slate-500 hover:text-red-500 text-sm font-medium transition-colors">
                <LogOut size={16}/> Sign Out
              </button>
            </div>
          </aside>
          <main className="flex-1 overflow-y-auto">
            <div className="p-4 md:p-8 max-w-6xl mx-auto">
              <SuperAdminPanel user={user} onBack={() => setCurrentRoute('organiser-dashboard')}/>
            </div>
          </main>
        </div>
      )}

      {/* ---- ORGANISER DASHBOARD ---- */}
      {currentRoute === 'organiser-dashboard' && ['organiser', 'super_admin'].includes(user?.role) && (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex">
          {/* Mobile nav overlay */}
          {mobileNavOpen && (
            <div className="fixed inset-0 z-50 md:hidden" onClick={() => setMobileNavOpen(false)}>
              <div className="absolute inset-0 bg-black/40"/>
              <aside className="absolute left-0 top-0 bottom-0 w-64 bg-white dark:bg-slate-800 flex flex-col shadow-xl" onClick={e => e.stopPropagation()}>
                <div className="p-5 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2"><div className="p-1.5 bg-sky-500 rounded-xl"><Trophy size={16} className="text-white"/></div><span className="font-bold text-slate-800">SportsDay Pro</span></div>
                  <button onClick={() => setMobileNavOpen(false)} className="text-slate-400 hover:text-slate-700 p-1"><X size={20}/></button>
                </div>
                <nav className="flex-1 p-3 space-y-1">
                  <NavItems onNavigate={() => setMobileNavOpen(false)}/>
                </nav>
                <div className="p-3 border-t border-slate-200">
                  <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-red-50 rounded-xl text-slate-500 hover:text-red-500 text-sm font-medium transition-colors"><LogOut size={16}/> Sign Out</button>
                </div>
              </aside>
            </div>
          )}

          {/* Desktop sidebar */}
          <aside className="w-56 bg-white dark:bg-slate-800 flex-col hidden md:flex hide-on-print flex-shrink-0 border-r border-slate-200 dark:border-slate-700">
            <div className="p-5 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-sky-500 rounded-xl"><Trophy size={18} className="text-white"/></div>
                <span className="font-bold text-slate-800 dark:text-white text-base tracking-tight">SportsDay Pro</span>
              </div>
              <div className="mt-1.5 text-xs uppercase tracking-widest text-slate-400 dark:text-slate-500 font-semibold">{user.role} Portal</div>
            </div>
            <nav className="flex-1 p-3 space-y-0.5"><NavItems/></nav>
            <div className="p-3 border-t border-slate-200 dark:border-slate-700">
              <button onClick={() => setDarkMode(d => !d)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-800 dark:hover:text-slate-200 text-sm font-medium transition-colors mb-1">
                {darkMode ? <Sun size={16}/> : <Moon size={16}/>}
                {darkMode ? 'Light Mode' : 'Dark Mode'}
              </button>
              <div className="flex items-center gap-2.5 px-3 py-2 mb-1">
                <div className="w-8 h-8 rounded-full bg-sky-100 dark:bg-sky-900/40 flex items-center justify-center text-sky-600 dark:text-sky-400 text-sm font-bold flex-shrink-0">
                  {(user.first_name || '?')[0].toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-slate-800 dark:text-slate-200 text-sm font-semibold truncate">{user.first_name}</p>
                  <p className="text-slate-400 text-xs truncate">{user.email}</p>
                </div>
              </div>
              <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors text-slate-500 dark:text-slate-400 hover:text-red-500 text-sm font-medium">
                <LogOut size={16}/> Sign Out
              </button>
            </div>
          </aside>

          <main className="flex-1 overflow-y-auto min-w-0">
            {/* Mobile header */}
            <div className="md:hidden bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-4 flex justify-between items-center hide-on-print">
              <div className="flex items-center gap-2"><div className="p-1 bg-sky-500 rounded-lg"><Trophy size={16} className="text-white"/></div><span className="font-bold text-slate-800">SportsDay Pro</span></div>
              <div className="flex items-center gap-1">
                <button onClick={() => setMobileNavOpen(true)} className="p-2 text-slate-500 hover:text-slate-800"><Menu size={22}/></button>
                <button onClick={handleLogout} className="p-2 text-slate-500 hover:text-red-500"><LogOut size={20}/></button>
              </div>
            </div>
            <div className="p-4 md:p-8 max-w-6xl mx-auto relative print-container">
              <OrganiserDashboard user={user} currentView={organiserView} setCurrentView={setOrganiserView} showToast={showToast} onFlagsChange={setOpenFlagCount}/>
            </div>
          </main>
        </div>
      )}

      {/* ---- STAFF DASHBOARD ---- */}
      {currentRoute === 'staff-dashboard' && user && (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex">
          <aside className="w-56 bg-white dark:bg-slate-800 flex-col hidden md:flex hide-on-print flex-shrink-0 border-r border-slate-200 dark:border-slate-700">
            <div className="p-5 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-sky-500 rounded-xl"><Trophy size={18} className="text-white"/></div>
                <span className="font-bold text-slate-800 dark:text-white text-base tracking-tight">SportsDay Pro</span>
              </div>
              <div className="mt-1.5 text-xs uppercase tracking-widest text-slate-400 dark:text-slate-500 font-semibold">{user.role} Portal</div>
            </div>
            <nav className="flex-1 p-3 space-y-0.5">
              <div className="px-3 py-2.5 rounded-xl flex items-center gap-3 bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 text-sm font-semibold"><Activity size={18}/> Dashboard <div className="ml-auto w-1.5 h-1.5 rounded-full bg-sky-500"/></div>
            </nav>
            <div className="p-3 border-t border-slate-200 dark:border-slate-700">
              <button onClick={() => setDarkMode(d => !d)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-800 dark:hover:text-slate-200 text-sm font-medium transition-colors mb-1">
                {darkMode ? <Sun size={16}/> : <Moon size={16}/>}
                {darkMode ? 'Light Mode' : 'Dark Mode'}
              </button>
              <div className="flex items-center gap-2.5 px-3 py-2 mb-1">
                <div className="w-8 h-8 rounded-full bg-sky-100 dark:bg-sky-900 flex items-center justify-center text-sky-600 dark:text-sky-400 text-sm font-bold flex-shrink-0">{(user.first_name || '?')[0].toUpperCase()}</div>
                <div className="min-w-0"><p className="text-slate-800 dark:text-white text-sm font-semibold truncate">{user.first_name}</p><p className="text-slate-400 text-xs truncate">{user.email}</p></div>
              </div>
              <button onClick={() => setShowChangePw(true)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-800 dark:hover:text-slate-200 text-sm font-medium transition-colors mb-1">
                <Key size={16}/> Change Password
              </button>
              <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors text-slate-500 hover:text-red-500 text-sm font-medium"><LogOut size={16}/> Sign Out</button>
            </div>
          </aside>
          {showChangePw && (
            <ChangePasswordModal onClose={() => setShowChangePw(false)} showToast={showToast}/>
          )}
          <main className="flex-1 overflow-y-auto min-w-0">
            <div className="md:hidden bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-4 flex justify-between items-center hide-on-print">
              <div className="flex items-center gap-2"><div className="p-1 bg-sky-500 rounded-lg"><Trophy size={16} className="text-white"/></div><span className="font-bold text-slate-800 dark:text-white">SportsDay Pro</span></div>
              <div className="flex items-center gap-1">
                <button onClick={() => setShowChangePw(true)} className="p-2 text-slate-500 dark:text-slate-400 hover:text-sky-600" title="Change Password"><Key size={18}/></button>
                <button onClick={handleLogout} className="p-2 text-slate-500 hover:text-red-500"><LogOut size={20}/></button>
              </div>
            </div>
            <div className="p-4 md:p-8 max-w-6xl mx-auto relative print-container">
              <StaffDashboard user={user} showToast={showToast}/>
            </div>
          </main>
        </div>
      )}
    </>
  );
}
