import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Calendar, Ticket, Shield, Search, Trash2, Edit, AlertCircle, CheckCircle, Database, LayoutDashboard, RefreshCw, LogOut, TrendingUp, Clock, MapPin, XCircle } from 'lucide-react';
import { User, Event, Registration, Role, EventStatus } from '../types';
import { getAdminData, deleteAccount, deleteEvent, updateEvent, saveUserProfile, updateEventStatus } from '../services/storageService';

interface AdminDashboardProps {
    currentUser: User;
    onLogout: () => void;
}

type AdminTab = 'dashboard' | 'users' | 'events' | 'paid-events' | 'registrations' | 'approvals';

export default function AdminDashboard({ currentUser, onLogout }: AdminDashboardProps) {
    const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [users, setUsers] = useState<User[]>([]);
    const [events, setEvents] = useState<Event[]>([]);
    const [registrations, setRegistrations] = useState<Registration[]>([]);

    // Filtering states
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

    const loadData = async () => {
        setLoading(true);
        try {

            if (currentUser.role !== 'admin') {
                alert("Access Denied");
                return;
            }

            const data = await getAdminData(currentUser.id, currentUser.email, currentUser.role);
            setUsers(data.users);
            setEvents(data.events);
            setRegistrations(data.registrations);
        } catch (e) {
            console.error("Failed to load admin data", e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [currentUser]);

    const handleRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    const handleDeleteUser = async (userId: string) => {
        if (window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
            await deleteAccount(userId, false);
            handleRefresh();
        }
    };

    const handleDeleteEvent = async (eventId: string) => {
        if (window.confirm('Delete this event?')) {
            await deleteEvent(eventId);
            handleRefresh();
        }
    };

    const handleApproveEvent = async (eventId: string) => {
        const success = await updateEventStatus(eventId, EventStatus.APPROVED);
        if (success) {
            handleRefresh();
        } else {
            alert("Failed to approve event");
        }
    };

    const handleRejectEvent = async (eventId: string) => {
        if (window.confirm('Reject this event?')) {
            const success = await updateEventStatus(eventId, EventStatus.REJECTED);
            if (success) {
                handleRefresh();
            } else {
                alert("Failed to reject event");
            }
        }
    };





    const filteredUsers = users.filter(u =>
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const filteredEvents = events.filter(e =>
        e.title.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getStats = () => [
        { label: 'Total Users', value: users.length, icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10' },
        { label: 'Total Events', value: events.length, icon: Calendar, color: 'text-purple-400', bg: 'bg-purple-500/10' },
        { label: 'Registrations', value: registrations.length, icon: Ticket, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
        { label: 'Revenue', value: `₹${registrations.reduce((acc, r) => acc + (r.paymentDetails?.amount || 0), 0)}`, icon: Database, color: 'text-amber-400', bg: 'bg-amber-500/10' },
        {
            label: 'Pending Approvals',
            value: events.filter(e => e.status === EventStatus.PENDING).length,
            icon: AlertCircle,
            color: 'text-rose-400',
            bg: 'bg-rose-500/10'
        },
    ];

    const getTopEvents = () => {
        const counts: Record<string, number> = {};
        registrations.forEach(r => { counts[r.eventId] = (counts[r.eventId] || 0) + 1; });
        return Object.entries(counts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([id, count]) => ({ event: events.find(e => e.id === id), count }))
            .filter(item => item.event);
    };

    const getRecentActivity = () => {
        return [...registrations]
            .sort((a, b) => new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime())
            .slice(0, 5);
    };

    const getUserStats = (userId: string) => {
        const userRegs = registrations.filter(r => r.participantId === userId);
        const count = userRegs.length;
        const spent = userRegs.reduce((acc, r) => acc + (r.paymentDetails?.amount || 0), 0);
        return { count, spent };
    };

    const getEventStats = (eventId: string) => {
        const event = events.find(e => e.id === eventId);
        const eventRegs = registrations.filter(r => r.eventId === eventId);
        let revenue = eventRegs.reduce((acc, r) => acc + (r.paymentDetails?.amount || 0), 0);
        const filled = eventRegs.length;


        if (event && event.isPaid) {
            const fixedFee = (event.capacity || 0) < 100 ? 49 : 99;
            revenue = revenue - fixedFee;
        }

        return { revenue, filled };
    };

    if (currentUser.role !== 'admin') {
        return (
            <div className="flex flex-col items-center justify-center p-20 text-center">
                <Shield className="w-16 h-16 text-rose-500 mb-4" />
                <h1 className="text-2xl font-bold text-white mb-2">Access Restricted</h1>
                <p className="text-slate-400">You do not have permission to view this page.</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen pb-20 pt-24 px-4 sm:px-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                <div>
                    <h1 className="text-3xl font-black font-outfit text-white tracking-tight">
                        Admin Console
                    </h1>
                    <p className="text-slate-400 mt-1">Manage users, events, and system settings</p>
                </div>

                <button
                    onClick={handleRefresh}
                    disabled={refreshing || loading}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-white font-medium disabled:opacity-50"
                >
                    <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                    Refresh Data
                </button>
                <button
                    onClick={onLogout}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 transition-all text-rose-400 font-medium"
                >
                    <LogOut className="w-4 h-4" />
                    Logout
                </button>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2 scrollbar-hide">
                {(['dashboard', 'users', 'events', 'paid-events', 'registrations', 'approvals'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-6 py-2.5 rounded-full text-sm font-bold uppercase tracking-wider transition-all whitespace-nowrap ${activeTab === tab
                            ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                            : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
                            }`}
                    >
                        {tab.replace('-', ' ')}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20">
                    <div className="w-10 h-10 border-4 border-orange-500/30 border-t-orange-500 rounded-full animate-spin mb-4" />
                    <p className="text-slate-400 font-medium">Loading admin data...</p>
                </div>
            ) : (
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                    >
                        {/* DASHBOARD */}
                        {/* DASHBOARD */}
                        {activeTab === 'dashboard' && (
                            <div className="space-y-8">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                    {getStats().map((stat, i) => (
                                        <div key={i} className="bg-white/[0.02] border border-white/10 rounded-2xl p-6 hover:bg-white/[0.04] transition-all group">
                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${stat.bg} ${stat.color}`}>
                                                <stat.icon className="w-6 h-6" />
                                            </div>
                                            <h3 className="text-slate-400 text-sm font-medium uppercase tracking-wider">{stat.label}</h3>
                                            <p className="text-3xl font-black text-white mt-1 font-outfit">{stat.value}</p>
                                        </div>
                                    ))}
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    {/* TOP EVENTS */}
                                    <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-6">
                                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                            <TrendingUp className="w-5 h-5 text-emerald-500" />
                                            Top Performing Events
                                        </h3>
                                        <div className="space-y-4">
                                            {getTopEvents().length > 0 ? getTopEvents().map(({ event, count }) => (
                                                <div key={event!.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                                                    <div className="flex items-center gap-3 overflow-hidden">
                                                        <div className="w-10 h-10 rounded-lg bg-slate-800 flex-shrink-0 overflow-hidden">
                                                            {event!.imageUrl && <img src={event!.imageUrl} className="w-full h-full object-cover" />}
                                                        </div>
                                                        <div className="min-w-0 pr-4">
                                                            <p className="font-bold text-white text-sm truncate">{event!.title}</p>
                                                            <p className="text-xs text-slate-500">{new Date(event!.date).toLocaleDateString()}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-lg font-black text-white">{count}</span>
                                                        <span className="text-[10px] text-slate-500 uppercase">Regs</span>
                                                    </div>
                                                </div>
                                            )) : <p className="text-slate-500 text-sm">No event data available.</p>}
                                        </div>
                                    </div>

                                    {/* RECENT ACTIVITY */}
                                    <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-6">
                                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                            <Clock className="w-5 h-5 text-blue-500" />
                                            Recent Activity
                                        </h3>
                                        <div className="space-y-4">
                                            {getRecentActivity().length > 0 ? getRecentActivity().map(reg => (
                                                <div key={reg.id} className="flex items-start gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors border-l-2 border-transparent hover:border-blue-500">
                                                    <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center flex-shrink-0 text-xs font-bold text-slate-400">
                                                        {reg.participantName.charAt(0)}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm text-slate-300">
                                                            <span className="font-bold text-white">{reg.participantName}</span> registered for <span className="text-blue-400">{events.find(e => e.id === reg.eventId)?.title || 'Event'}</span>
                                                        </p>
                                                        <p className="text-[10px] text-slate-500 mt-1">{new Date(reg.registeredAt).toLocaleString()}</p>
                                                    </div>
                                                </div>
                                            )) : <p className="text-slate-500 text-sm">No recent activity.</p>}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* USERS */}
                        {activeTab === 'users' && (
                            <div className="space-y-6">
                                <div className="relative">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                                    <input
                                        type="text"
                                        placeholder="Search users by name or email..."
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder:text-slate-600 focus:outline-none focus:border-orange-500/50 transition-all"
                                    />
                                </div>

                                <div className="bg-white/[0.02] border border-white/10 rounded-2xl overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left">
                                            <thead className="bg-white/5 text-slate-400 text-xs font-bold uppercase tracking-wider">
                                                <tr>
                                                    <th className="px-6 py-4">User</th>
                                                    <th className="px-6 py-4">Activity</th>
                                                    <th className="px-6 py-4">Role</th>
                                                    <th className="px-6 py-4">ID</th>
                                                    <th className="px-6 py-4 text-right">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/10">
                                                {filteredUsers.map(user => {
                                                    const stats = getUserStats(user.id);
                                                    return (
                                                        <tr key={user.id} className="hover:bg-white/[0.02] transition-colors">
                                                            <td className="px-6 py-4">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center overflow-hidden">
                                                                        {user.avatarUrl ? (
                                                                            <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                                                                        ) : (
                                                                            <span className="text-sm font-bold text-slate-400">{user.name.charAt(0).toUpperCase()}</span>
                                                                        )}
                                                                    </div>
                                                                    <div>
                                                                        <p className="font-bold text-white">{user.name}</p>
                                                                        <p className="text-xs text-slate-400">{user.email}</p>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <div className="flex flex-col">
                                                                    <span className="text-sm font-bold text-white">{stats.count} Regs</span>
                                                                    <span className="text-xs text-slate-500">${stats.spent} Spent</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${user.role === 'admin' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                                                                    user.role === 'organizer' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                                                                        'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                                                                    }`}>
                                                                    {user.role}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4 text-xs text-slate-500 font-mono">
                                                                {user.id}
                                                            </td>
                                                            <td className="px-6 py-4 text-right">
                                                                <div className="flex items-center justify-end gap-2">

                                                                    <button
                                                                        onClick={() => handleDeleteUser(user.id)}
                                                                        className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-all"
                                                                        title="Delete User"
                                                                        disabled={user.id === currentUser.id}
                                                                    >
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* EVENTS */}
                        {activeTab === 'events' && (
                            <div className="space-y-6">
                                <div className="relative">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                                    <input
                                        type="text"
                                        placeholder="Search events..."
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder:text-slate-600 focus:outline-none focus:border-orange-500/50 transition-all"
                                    />
                                </div>

                                <div className="bg-white/[0.02] border border-white/10 rounded-2xl overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left">
                                            <thead className="bg-white/5 text-slate-400 text-xs font-bold uppercase tracking-wider">
                                                <tr>
                                                    <th className="px-6 py-4">Event</th>
                                                    <th className="px-6 py-4">Details</th>
                                                    <th className="px-6 py-4">Location</th>
                                                    <th className="px-6 py-4">Stats</th>
                                                    <th className="px-6 py-4 text-right">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/10">
                                                {filteredEvents.map(event => (
                                                    <tr key={event.id} className="hover:bg-white/[0.02] transition-colors">
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-12 h-12 rounded-lg bg-slate-800 overflow-hidden flex-shrink-0">
                                                                    {event.imageUrl && (
                                                                        <img src={event.imageUrl} alt={event.title} className="w-full h-full object-cover" />
                                                                    )}
                                                                </div>
                                                                <div>
                                                                    <p className="font-bold text-white line-clamp-1">{event.title}</p>
                                                                    <p className="text-xs text-slate-500 font-mono">ID: {event.id.slice(0, 8)}...</p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex flex-col gap-1">
                                                                <span className="text-sm text-slate-300 flex items-center gap-1">
                                                                    <Calendar className="w-3 h-3 text-slate-500" />
                                                                    {new Date(event.date).toLocaleDateString()}
                                                                </span>
                                                                <span className="text-xs text-slate-500 flex items-center gap-1">
                                                                    {event.organizerId.slice(0, 8)}...
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-sm text-slate-400">
                                                            <div className="flex flex-col">
                                                                <span>{event.location}</span>
                                                                <span className="text-xs text-slate-600 uppercase font-bold">{event.locationType}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex flex-col gap-1">
                                                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full w-fit ${event.isPaid ? 'bg-emerald-500/10 text-emerald-400' : 'bg-blue-500/10 text-blue-400'}`}>
                                                                    {event.isPaid ? `$${event.price}` : 'Free'}
                                                                </span>
                                                                <div className="flex items-center gap-2 text-xs text-slate-400">
                                                                    <span>Cap: {event.capacity}</span>
                                                                    <span className="w-1 h-1 rounded-full bg-slate-600"></span>
                                                                    <span className="text-emerald-400 font-bold">${getEventStats(event.id).revenue}</span>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <div className="flex items-center justify-end gap-2">
                                                                <button
                                                                    onClick={() => setSelectedEvent(event)}
                                                                    className="p-2 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 transition-all"
                                                                    title="View Details"
                                                                >
                                                                    <Search className="w-4 h-4" />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteEvent(event.id)}
                                                                    className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-all"
                                                                    title="Delete Event"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* PAID EVENTS */}
                        {activeTab === 'paid-events' && (
                            <div className="space-y-6">
                                <div className="bg-white/[0.02] border border-white/10 rounded-2xl overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left">
                                            <thead className="bg-white/5 text-slate-400 text-xs font-bold uppercase tracking-wider">
                                                <tr>
                                                    <th className="px-6 py-4">Event</th>
                                                    <th className="px-6 py-4">Organizer</th>
                                                    <th className="px-6 py-4">Revenue</th>
                                                    <th className="px-6 py-4">Settlement Status</th>
                                                    <th className="px-6 py-4 text-right">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/10">
                                                {events.filter(e => e.isPaid).map(event => {
                                                    const stats = getEventStats(event.id);
                                                    return (
                                                        <tr key={event.id} className="hover:bg-white/[0.02] transition-colors">
                                                            <td className="px-6 py-4">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-10 h-10 rounded-lg bg-slate-800 overflow-hidden flex-shrink-0">
                                                                        {event.imageUrl && (
                                                                            <img src={event.imageUrl} alt={event.title} className="w-full h-full object-cover" />
                                                                        )}
                                                                    </div>
                                                                    <div>
                                                                        <p className="font-bold text-white line-clamp-1">{event.title}</p>
                                                                        <p className="text-xs text-slate-500 font-mono">{new Date(event.date).toLocaleDateString()}</p>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4 text-sm text-slate-300">
                                                                {users.find(u => u.id === event.organizerId)?.name || 'Unknown'}
                                                                <br />
                                                                <span className="text-xs text-slate-500">{users.find(u => u.id === event.organizerId)?.email}</span>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <span className="text-emerald-400 font-bold">₹{stats.revenue}</span>
                                                                <span className="text-xs text-slate-500 block">{stats.filled} registrations</span>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <select
                                                                    value={event.settlementStatus || 'NOT_PROCESSED'}
                                                                    onChange={async (e) => {
                                                                        const newStatus = e.target.value as any;
                                                                        // Optimistic update locally
                                                                        setEvents(prev => prev.map(ev => ev.id === event.id ? { ...ev, settlementStatus: newStatus } : ev));

                                                                        try {
                                                                            await updateEvent({ ...event, settlementStatus: newStatus });
                                                                            // Also refresh to be sure
                                                                            // loadData(); 
                                                                        } catch (err) {
                                                                            console.error("Failed to update status", err);
                                                                            // Revert on error
                                                                            loadData();
                                                                        }
                                                                    }}
                                                                    className={`px-3 py-1.5 rounded-lg border text-xs font-bold uppercase tracking-wider outline-none cursor-pointer transition-colors ${event.settlementStatus === 'PROCESSED'
                                                                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 focus:border-emerald-500'
                                                                        : event.settlementStatus === 'PROCESSING'
                                                                            ? 'bg-blue-500/10 border-blue-500/20 text-blue-400 focus:border-blue-500'
                                                                            : 'bg-slate-800 border-slate-700 text-slate-400 focus:border-slate-600'
                                                                        }`}
                                                                >
                                                                    <option value="NOT_PROCESSED" className="bg-slate-900 text-slate-400">Not Processed</option>
                                                                    <option value="PROCESSING" className="bg-slate-900 text-blue-400">Processing</option>
                                                                    <option value="PROCESSED" className="bg-slate-900 text-emerald-400">Processed</option>
                                                                </select>
                                                            </td>
                                                            <td className="px-6 py-4 text-right">
                                                                <button
                                                                    onClick={() => setSelectedEvent(event)}
                                                                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all"
                                                                    title="View Details"
                                                                >
                                                                    <Search className="w-4 h-4" />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                                {events.filter(e => e.isPaid).length === 0 && (
                                                    <tr>
                                                        <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                                                            No paid events found.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* APPROVALS */}
                        {activeTab === 'approvals' && (
                            <div className="space-y-6">
                                <div className="bg-white/[0.02] border border-white/10 rounded-2xl overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left">
                                            <thead className="bg-white/5 text-slate-400 text-xs font-bold uppercase tracking-wider">
                                                <tr>
                                                    <th className="px-6 py-4">Event</th>
                                                    <th className="px-6 py-4">Organizer</th>
                                                    <th className="px-6 py-4">Details</th>
                                                    <th className="px-6 py-4 text-right">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/10">
                                                {events.filter(e => e.status === EventStatus.PENDING).map(event => (
                                                    <tr key={event.id} className="hover:bg-white/[0.02] transition-colors">
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-12 h-12 rounded-lg bg-slate-800 overflow-hidden flex-shrink-0">
                                                                    {event.imageUrl && <img src={event.imageUrl} className="w-full h-full object-cover" />}
                                                                </div>
                                                                <div>
                                                                    <p className="font-bold text-white line-clamp-1">{event.title}</p>
                                                                    <p className="text-xs text-slate-500 font-mono">ID: {event.id.slice(0, 8)}...</p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex flex-col">
                                                                <span className="text-sm text-slate-300">{users.find(u => u.id === event.organizerId)?.name || 'Unknown'}</span>
                                                                <span className="text-xs text-slate-500">{users.find(u => u.id === event.organizerId)?.email}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex flex-col gap-1">
                                                                <span className="text-xs text-slate-400 flex items-center gap-1">
                                                                    <Calendar className="w-3 h-3" />
                                                                    {new Date(event.date).toLocaleDateString()}
                                                                </span>
                                                                <span className="text-xs text-slate-400 flex items-center gap-1">
                                                                    <MapPin className="w-3 h-3" />
                                                                    {event.location}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <div className="flex items-center justify-end gap-2">
                                                                <button
                                                                    onClick={() => handleApproveEvent(event.id)}
                                                                    className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-1.5 transition-all"
                                                                >
                                                                    <CheckCircle className="w-3.5 h-3.5" />
                                                                    Approve
                                                                </button>
                                                                <button
                                                                    onClick={() => handleRejectEvent(event.id)}
                                                                    className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 text-xs font-bold flex items-center gap-1.5 transition-all"
                                                                >
                                                                    <XCircle className="w-3.5 h-3.5" />
                                                                    Reject
                                                                </button>
                                                                <button
                                                                    onClick={() => setSelectedEvent(event)}
                                                                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 transition-all"
                                                                >
                                                                    <Search className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                                {events.filter(e => e.status === EventStatus.PENDING).length === 0 && (
                                                    <tr>
                                                        <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                                                            No pending event approval requests.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}
                        {/* REGISTRATIONS */}
                        {activeTab === 'registrations' && (
                            <div className="space-y-6">
                                <div className="bg-white/[0.02] border border-white/10 rounded-2xl overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left">
                                            <thead className="bg-white/5 text-slate-400 text-xs font-bold uppercase tracking-wider">
                                                <tr>
                                                    <th className="px-6 py-4">ID</th>
                                                    <th className="px-6 py-4">Participant</th>
                                                    <th className="px-6 py-4">Event</th>
                                                    <th className="px-6 py-4">Status</th>
                                                    <th className="px-6 py-4">Payment</th>
                                                    <th className="px-6 py-4 text-right">Date</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/10">
                                                {registrations.map(reg => (
                                                    <tr key={reg.id} className="hover:bg-white/[0.02] transition-colors">
                                                        <td className="px-6 py-4 text-xs text-slate-500 font-mono">
                                                            {reg.id.slice(0, 8)}...
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex flex-col">
                                                                <span className="font-bold text-white">{reg.participantName}</span>
                                                                <span className="text-xs text-slate-500">{reg.participantEmail}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-sm text-slate-300">
                                                            {events.find(e => e.id === reg.eventId)?.title || 'Unknown Event'}
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${reg.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-400' :
                                                                reg.status === 'PENDING' ? 'bg-amber-500/10 text-amber-400' :
                                                                    'bg-white/5 text-slate-400'
                                                                }`}>
                                                                {reg.status}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            {reg.paymentDetails ? (
                                                                <div className="flex flex-col">
                                                                    <span className="text-sm font-bold text-white">${reg.paymentDetails.amount}</span>
                                                                    <span className={`text-[10px] uppercase ${reg.paymentDetails.status === 'COMPLETED' ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                                        {reg.paymentDetails.status}
                                                                    </span>
                                                                </div>
                                                            ) : (
                                                                <span className="text-xs text-slate-600">-</span>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4 text-right text-xs text-slate-500">
                                                            {new Date(reg.registeredAt).toLocaleDateString()}
                                                        </td>
                                                    </tr>
                                                ))}
                                                {registrations.length === 0 && (
                                                    <tr>
                                                        <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                                            No registrations found.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}

                    </motion.div>
                </AnimatePresence>
            )}
            {/* EVENT DETAILS MODAL */}
            <AnimatePresence>
                {selectedEvent && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={() => setSelectedEvent(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="p-6 border-b border-white/10 flex items-center justify-between">
                                <h2 className="text-2xl font-black font-outfit text-white">Event Details</h2>
                                <button
                                    onClick={() => setSelectedEvent(null)}
                                    className="p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                                >
                                    <LogOut className="w-5 h-5 rotate-180" />
                                </button>
                            </div>

                            <div className="p-8 overflow-y-auto space-y-8">
                                {/* Header Info */}
                                <div className="flex gap-6">
                                    <div className="w-32 h-32 rounded-2xl bg-slate-800 overflow-hidden flex-shrink-0 border border-white/10">
                                        {selectedEvent.imageUrl ? (
                                            <img src={selectedEvent.imageUrl} alt={selectedEvent.title} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-slate-600">
                                                <Calendar className="w-10 h-10 opacity-50" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h3 className="text-2xl font-bold text-white mb-2">{selectedEvent.title}</h3>
                                                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${selectedEvent.isPaid ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                                    }`}>
                                                    {selectedEvent.isPaid ? 'Paid Event' : 'Free Event'}
                                                </span>
                                            </div>
                                            <div className="text-slate-500 text-xs font-mono border border-slate-800 rounded px-2 py-1">
                                                ID: {selectedEvent.id}
                                            </div>
                                        </div>
                                        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                                            <div className="flex items-center gap-2 text-slate-300">
                                                <Calendar className="w-4 h-4 text-orange-500" />
                                                {new Date(selectedEvent.date).toLocaleString()}
                                            </div>
                                            <div className="flex items-center gap-2 text-slate-300">
                                                <Clock className="w-4 h-4 text-orange-500" />
                                                Ends: {new Date(selectedEvent.endDate).toLocaleString()}
                                            </div>
                                            <div className="flex items-center gap-2 text-slate-300">
                                                <Users className="w-4 h-4 text-orange-500" />
                                                Organizer: {selectedEvent.organizerId}
                                            </div>
                                            <div className="flex items-center gap-2 text-slate-300">
                                                <Shield className="w-4 h-4 text-orange-500" />
                                                Capacity: {selectedEvent.capacity}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Description */}
                                <div>
                                    <h4 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-3">Description</h4>
                                    <div className="bg-white/5 rounded-xl p-4 text-slate-300 text-sm leading-relaxed border border-white/5">
                                        {selectedEvent.description}
                                    </div>
                                </div>

                                {/* Payment Details Section - NEW */}
                                {selectedEvent.isPaid && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <h4 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-3">Ticket Info</h4>
                                            <div className="bg-white/5 rounded-xl p-4 border border-white/5 space-y-2">
                                                <div className="flex justify-between">
                                                    <span className="text-slate-400 text-sm">Price</span>
                                                    <span className="text-white font-bold">₹{selectedEvent.price}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-slate-400 text-sm">Currency</span>
                                                    <span className="text-slate-300">INR</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div>
                                            <h4 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-3">Organizer Payment Info</h4>
                                            <div className="bg-white/5 rounded-xl p-4 border border-white/5 space-y-3">
                                                {selectedEvent.organizerPaymentDetails?.upiId && (
                                                    <div>
                                                        <span className="block text-[10px] text-slate-500 uppercase font-bold">UPI ID</span>
                                                        <code className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded text-sm">{selectedEvent.organizerPaymentDetails.upiId}</code>
                                                    </div>
                                                )}

                                                {selectedEvent.organizerPaymentDetails?.bankDetails && (
                                                    <div className="pt-2 border-t border-white/5">
                                                        <span className="block text-[10px] text-slate-500 uppercase font-bold mb-1">Bank Transfer</span>
                                                        <div className="text-sm text-slate-300 space-y-1">
                                                            <p><span className="text-slate-500">Name:</span> {selectedEvent.organizerPaymentDetails.bankDetails.accountName}</p>
                                                            <p><span className="text-slate-500">Acc No:</span> {selectedEvent.organizerPaymentDetails.bankDetails.accountNumber}</p>
                                                            <p><span className="text-slate-500">IFSC:</span> {selectedEvent.organizerPaymentDetails.bankDetails.ifsc}</p>
                                                        </div>
                                                    </div>
                                                )}

                                                {!selectedEvent.organizerPaymentDetails?.upiId && !selectedEvent.organizerPaymentDetails?.bankDetails && (
                                                    <p className="text-slate-500 italic text-sm">No payment details provided by organizer.</p>
                                                )}

                                                <div className="pt-2 border-t border-white/5 mt-4">
                                                    <span className="block text-[10px] text-slate-500 uppercase font-bold mb-2">Settlement Status</span>
                                                    <select
                                                        value={selectedEvent.settlementStatus || 'NOT_PROCESSED'}
                                                        onChange={async (e) => {
                                                            const newStatus = e.target.value as any;
                                                            // Optimistic update
                                                            setSelectedEvent({ ...selectedEvent, settlementStatus: newStatus });
                                                            // Call API
                                                            await updateEvent({ ...selectedEvent, settlementStatus: newStatus });
                                                            // Refresh list
                                                            await loadData();
                                                        }}
                                                        className={`w-full px-3 py-2 rounded-lg border text-sm font-bold uppercase tracking-wider outline-none transition-colors cursor-pointer ${selectedEvent.settlementStatus === 'PROCESSED'
                                                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 focus:border-emerald-500'
                                                            : selectedEvent.settlementStatus === 'PROCESSING'
                                                                ? 'bg-blue-500/10 border-blue-500/20 text-blue-400 focus:border-blue-500'
                                                                : 'bg-slate-800 border-slate-700 text-slate-400 focus:border-slate-600'
                                                            }`}
                                                    >
                                                        <option value="NOT_PROCESSED" className="bg-slate-900 text-slate-400">Not Processed</option>
                                                        <option value="PROCESSING" className="bg-slate-900 text-blue-400">Processing</option>
                                                        <option value="PROCESSED" className="bg-slate-900 text-emerald-400">Processed</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Other Details Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Location */}
                                    <div>
                                        <h4 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-3">Location</h4>
                                        <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                                            <p className="text-white font-medium">{selectedEvent.location}</p>
                                            <span className="inline-block mt-2 text-xs font-bold text-slate-500 bg-slate-800 px-2 py-1 rounded upercase">
                                                {selectedEvent.locationType}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Participation */}
                                    <div>
                                        <h4 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-3">Participation</h4>
                                        <div className="bg-white/5 rounded-xl p-4 border border-white/5 text-sm text-slate-300 space-y-2">
                                            <div className="flex justify-between">
                                                <span className="text-slate-400">Mode</span>
                                                <span className="capitalize text-white">{selectedEvent.participationMode || 'individual'}</span>
                                            </div>
                                            {selectedEvent.maxTeamSize && (
                                                <div className="flex justify-between">
                                                    <span className="text-slate-400">Max Team Size</span>
                                                    <span className="text-white">{selectedEvent.maxTeamSize}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Promo Codes */}
                                {selectedEvent.promoCodes && selectedEvent.promoCodes.length > 0 && (
                                    <div>
                                        <h4 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-3">Active Promo Codes</h4>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                            {selectedEvent.promoCodes.map((promo, idx) => (
                                                <div key={idx} className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 flex justify-between items-center">
                                                    <div>
                                                        <p className="font-mono text-orange-400 font-bold">{promo.code}</p>
                                                        <p className="text-[10px] text-slate-500">
                                                            {promo.type === 'percentage' ? `${promo.value}% OFF` : `₹${promo.value} OFF`}
                                                        </p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-xs text-white">{promo.usedCount || 0}</p>
                                                        <p className="text-[10px] text-slate-500">USED</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
