import React, { useState, useEffect } from 'react';
import {
  Building2,
  Users,
  DoorOpen,
  Bed,
  CheckCircle2,
  AlertCircle,
  PlusCircle,
  LogOut,
  Search,
  Filter
} from 'lucide-react';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Hostel, Room, Student } from '../types';

export const HostelManagementPage: React.FC = () => {
  const { user } = useAuth();
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [selectedHostelId, setSelectedHostelId] = useState<string>('h-shivalik');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Allocation modal
  const [isAllocateOpen, setIsAllocateOpen] = useState(false);
  const [allocateForm, setAllocateForm] = useState({
    studentId: '',
    hostelId: 'h-shivalik',
    block: 'Block A',
    roomNumber: '102',
    bedNumber: 'C'
  });
  const [allocateMsg, setAllocateMsg] = useState<string | null>(null);

  // Vacate modal
  const [isVacateOpen, setIsVacateOpen] = useState(false);
  const [vacateTarget, setVacateTarget] = useState<Student | null>(null);
  const [clearanceNotes, setClearanceNotes] = useState('All room inventory verified and keys returned');
  const [vacateMsg, setVacateMsg] = useState<string | null>(null);

  const isStaff = ['residential_warden', 'warden', 'chief_warden', 'director', 'caretaker_operator'].includes(user?.role || '');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const hRes = await apiService.getHostels();
      if (hRes.success) {
        setHostels(hRes.hostels);
        const defaultH = user?.hostelId || hRes.hostels[0]?.id || 'h-shivalik';
        setSelectedHostelId(defaultH);
        fetchRooms(defaultH);
      }

      const sRes = await apiService.getStudents();
      if (sRes.success) setStudents(sRes.students);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRooms = async (hId: string) => {
    try {
      const rRes = await apiService.getHostelRooms(hId);
      if (rRes.success) setRooms(rRes.rooms);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const handleSelectHostel = (hId: string) => {
    setSelectedHostelId(hId);
    setAllocateForm((prev) => ({ ...prev, hostelId: hId }));
    fetchRooms(hId);
  };

  const handleAllocateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAllocateMsg(null);
    try {
      const res = await apiService.allocateRoom(allocateForm);
      if (res.success) {
        setAllocateMsg('Room allocated successfully.');
        setTimeout(() => {
          setIsAllocateOpen(false);
          setAllocateMsg(null);
          loadData();
        }, 1000);
      }
    } catch (err: any) {
      setAllocateMsg(err.response?.data?.message || 'Allocation failed');
    }
  };

  const handleVacateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vacateTarget) return;
    setVacateMsg(null);
    try {
      const res = await apiService.checkoutHostel({
        studentId: vacateTarget.id,
        clearanceNotes
      });
      if (res.success) {
        setVacateMsg(`Hostel checkout recorded for ${vacateTarget.name}. Bed vacated.`);
        setTimeout(() => {
          setIsVacateOpen(false);
          setVacateMsg(null);
          loadData();
        }, 1000);
      }
    } catch (err: any) {
      setVacateMsg(err.response?.data?.message || 'Vacate checkout failed');
    }
  };

  const selectedHostel = hostels.find((h) => h.id === selectedHostelId);
  const vacantRooms = rooms.filter((r) => r.isVacant);
  const activeResidents = students.filter(
    (s) => s.hostelId === selectedHostelId && s.checkoutStatus === 'active' && s.verificationStatus === 'verified'
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-slate-900">Hostel & Room Management (FR-04)</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200">
              Capacity & Occupancy Engine
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Blocks, floors, room allocation, vacant room tracking, and formal 'Hostel Empty' (checkout) records.
          </p>
        </div>

        {isStaff && (
          <button
            onClick={() => setIsAllocateOpen(true)}
            className="flex items-center space-x-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Allocate Student to Room</span>
          </button>
        )}
      </div>

      {/* Hostel Selection Tabs */}
      <div className="flex space-x-2 overflow-x-auto pb-1">
        {hostels.map((h) => (
          <button
            key={h.id}
            onClick={() => handleSelectHostel(h.id)}
            className={`px-4 py-2.5 rounded-xl font-semibold text-xs transition border flex items-center space-x-2 ${
              selectedHostelId === h.id
                ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>{h.name}</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${selectedHostelId === h.id ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-600'}`}>
              {h.code}
            </span>
          </button>
        ))}
      </div>

      {/* Hostel Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase">Total Capacity</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{selectedHostel?.capacity || 0} Beds</div>
          <div className="text-[11px] text-slate-400 mt-1">{selectedHostel?.totalRooms || 0} Rooms across {selectedHostel?.blocks.join(', ')}</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase">Active Occupants</div>
          <div className="text-2xl font-bold text-indigo-600 mt-1">{activeResidents.length} Students</div>
          <div className="text-[11px] text-emerald-600 font-medium mt-1">Verified Allotments</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase">Vacant Rooms</div>
          <div className="text-2xl font-bold text-emerald-600 mt-1">{vacantRooms.length} Rooms</div>
          <div className="text-[11px] text-slate-400 mt-1">Zero occupancy rooms</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase">Residential Warden</div>
          <div className="text-sm font-bold text-slate-800 mt-2">{selectedHostel?.residentialWarden}</div>
          <div className="text-[11px] text-slate-500 mt-1">Chief: {selectedHostel?.chiefWarden}</div>
        </div>
      </div>

      {/* Room Inventory & Occupancy Grid */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2 font-bold text-slate-800 text-sm">
            <DoorOpen className="w-4 h-4 text-indigo-600" />
            <span>Room Inventory & Active Allotments ({selectedHostel?.name})</span>
          </div>
          <div className="flex items-center space-x-3 text-xs text-slate-500">
            <span className="flex items-center"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 mr-1.5" /> Available Beds</span>
            <span className="flex items-center"><span className="w-2.5 h-2.5 rounded-full bg-slate-400 mr-1.5" /> Full Capacity</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rooms.map((room) => (
            <div
              key={room.id}
              className={`border rounded-xl p-4 transition ${
                room.status === 'full'
                  ? 'border-slate-200 bg-slate-50/60'
                  : 'border-emerald-200 bg-emerald-50/20'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-900 text-sm">Room {room.roomNumber}</span>
                  <span className="text-xs text-slate-500 ml-2">({room.block}, Floor {room.floor})</span>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${room.status === 'full' ? 'bg-slate-200 text-slate-700' : 'bg-emerald-100 text-emerald-800'}`}>
                  {room.currentOccupancy} / {room.capacity} Beds
                </span>
              </div>

              {/* Occupants list */}
              <div className="mt-3 pt-2 border-t border-slate-100 space-y-1.5 text-xs">
                {room.occupants && room.occupants.length > 0 ? (
                  room.occupants.map((occ) => (
                    <div key={occ.id} className="flex items-center justify-between text-slate-700 py-0.5">
                      <div className="flex items-center space-x-1.5">
                        <Bed className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-medium text-slate-800">{occ.name}</span>
                        <span className="text-[10px] text-slate-500">Bed {occ.bed || '—'}</span>
                        <span className="text-[10px] text-slate-400 font-mono">({occ.enrollmentNo})</span>
                      </div>
                      {isStaff && (
                        <button
                          onClick={() => {
                            const fullStu = students.find((s) => s.id === occ.id);
                            if (fullStu) {
                              setVacateTarget(fullStu);
                              setIsVacateOpen(true);
                            }
                          }}
                          className="text-[10px] text-rose-600 hover:text-rose-800 font-semibold px-1.5 py-0.5 rounded hover:bg-rose-50"
                          title="Record Hostel Checkout / Empty"
                        >
                          Checkout
                        </button>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-[11px] text-emerald-700 font-medium py-1">
                    ✓ Vacant Room (All {room.capacity} beds available)
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Room Allocation Modal */}
      {isAllocateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
              <h3 className="font-semibold text-sm">Allocate Student to Hostel Room (FR-04)</h3>
              <button onClick={() => setIsAllocateOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleAllocateSubmit} className="p-5 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 text-[10px] uppercase mb-1">Select Student</label>
                <select
                  required
                  value={allocateForm.studentId}
                  onChange={(e) => setAllocateForm({ ...allocateForm, studentId: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="">-- Choose Student --</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.enrollmentNo}) — Current: Room {s.roomNumber}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 text-[10px] uppercase mb-1">Hostel</label>
                <select
                  value={allocateForm.hostelId}
                  onChange={(e) => setAllocateForm({ ...allocateForm, hostelId: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                >
                  {hostels.map((h) => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 text-[10px] uppercase mb-1">Block</label>
                  <input
                    type="text"
                    required
                    value={allocateForm.block}
                    onChange={(e) => setAllocateForm({ ...allocateForm, block: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 text-[10px] uppercase mb-1">Room Number</label>
                  <input
                    type="text"
                    required
                    value={allocateForm.roomNumber}
                    onChange={(e) => setAllocateForm({ ...allocateForm, roomNumber: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 text-[10px] uppercase mb-1">Bed</label>
                <select
                  value={allocateForm.bedNumber}
                  onChange={(e) => setAllocateForm({ ...allocateForm, bedNumber: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="A">Bed A</option>
                  <option value="B">Bed B</option>
                  <option value="C">Bed C</option>
                </select>
              </div>

              {allocateMsg && (
                <div className={`p-2.5 rounded-lg text-xs ${allocateMsg.includes('success') ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>
                  {allocateMsg}
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAllocateOpen(false)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold"
                >
                  Confirm Allotment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Hostel Empty / Checkout Modal */}
      {isVacateOpen && vacateTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
              <h3 className="font-semibold text-sm">Formal Hostel Empty / Checkout</h3>
              <button onClick={() => setIsVacateOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleVacateSubmit} className="p-5 space-y-3 text-xs">
              <div className="p-3 bg-slate-50 border rounded-lg text-slate-700 space-y-1">
                <div><strong>Student:</strong> {vacateTarget.name} ({vacateTarget.enrollmentNo})</div>
                <div><strong>Room:</strong> {vacateTarget.block}, Room {vacateTarget.roomNumber}</div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 text-[10px] uppercase mb-1">Clearance / Vacating Notes</label>
                <textarea
                  required
                  rows={3}
                  value={clearanceNotes}
                  onChange={(e) => setClearanceNotes(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>

              {vacateMsg && (
                <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
                  {vacateMsg}
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsVacateOpen(false)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold"
                >
                  Process Checkout & Free Room
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
