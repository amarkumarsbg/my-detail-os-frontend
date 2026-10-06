"use client";

import { create } from "zustand";
import type { Vehicle, PaginationParams } from "@/types";
import { postVehicleSnapshot } from "@/lib/collection-sync";
import { apiGet, apiPost, apiPut, apiDelete, ApiError } from "@/lib/api-client";
import type { VehicleImportPayloadItem } from "@/lib/vehicle-import/types";

export type VehicleBulkImportResult = {
  created: Vehicle[];
  skipped: Array<{
    index: number;
    registrationNumber: string;
    reason: "DUPLICATE" | "INVALID" | "DUPLICATE_IN_BATCH" | "CUSTOMER_NOT_FOUND";
    message: string;
  }>;
  createdCount: number;
  skippedCount: number;
};

export async function fetchCustomerVehicles(customerId: string): Promise<Vehicle[]> {
  const vehicles = new Map<string, Vehicle>();
  for (let page = 1; ; page++) {
    const query = new URLSearchParams({ customerId, page: String(page), pageSize: "50" });
    const result = await apiGet<{
      vehicles: Vehicle[];
      metadata?: { totalPages: number };
    }>(`/api/vehicles?${query}`);
    for (const vehicle of result.vehicles) {
      if (vehicle.customerId === customerId) vehicles.set(vehicle.id, vehicle);
    }
    if (!result.metadata || page >= result.metadata.totalPages) break;
  }
  return [...vehicles.values()];
}

interface VehicleStore {
  vehicles: Vehicle[];
  vehiclesLoading: boolean;
  vehiclesError: string | null;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  isInitialLoaded: boolean;

  setVehicles: (value: Vehicle[] | ((prev: Vehicle[]) => Vehicle[])) => void;
  /** Refresh from API without triggering snapshot replace. */
  fetchVehicles: () => Promise<void>;
  fetchPaginatedVehicles: (params: PaginationParams, append?: boolean) => Promise<void>;
  /** Bulk-create via API; merges created rows into the store (no snapshot). */
  importVehicles: (vehicles: VehicleImportPayloadItem[]) => Promise<VehicleBulkImportResult>;
  addVehicle: (vehicle: Omit<Vehicle, "createdAt">) => Promise<Vehicle | null>;
  updateVehicle: (id: string, updates: Partial<Vehicle>) => Promise<Vehicle | null>;
  deleteVehicle: (id: string) => Promise<boolean>;
}

export const useVehicleStore = create<VehicleStore>((set, get) => ({
  vehicles: [],
  vehiclesLoading: false,
  vehiclesError: null,
  total: 0,
  page: 1,
  pageSize: 50,
  totalPages: 1,
  isInitialLoaded: false,

  setVehicles: (value) =>
    set((state) => {
      const vehicles = typeof value === "function" ? value(state.vehicles) : value;
      return { vehicles };
    }),

  fetchVehicles: async () => {
    return get().fetchPaginatedVehicles({ page: 1, pageSize: 50 });
  },

  fetchPaginatedVehicles: async (params, append = false) => {
    set({ vehiclesLoading: true, vehiclesError: null });
    try {
      const query = new URLSearchParams();
      query.append("page", params.page.toString());
      query.append("pageSize", params.pageSize.toString());
      if (params.search) query.append("search", params.search);
      if (params.sortBy) query.append("sortBy", params.sortBy);
      if (params.sortDir) query.append("sortDir", params.sortDir);
      if (params.filters) {
        Object.entries(params.filters).forEach(([k, v]) => {
          if (v !== undefined && v !== null && v !== "") {
            query.append(k, String(v));
          }
        });
      }

      const data = await apiGet<{ 
        vehicles: Vehicle[]; 
        metadata?: { total: number; page: number; pageSize: number; totalPages: number } 
      }>(`/api/vehicles?${query.toString()}`);
      
      const newItems = data.vehicles;
      
      set((state) => ({ 
        vehicles: append ? [...state.vehicles, ...newItems] : newItems, 
        vehiclesLoading: false,
        isInitialLoaded: true,
        total: data.metadata?.total ?? (append ? state.total + newItems.length : newItems.length),
        page: data.metadata?.page ?? params.page,
        pageSize: data.metadata?.pageSize ?? params.pageSize,
        totalPages: data.metadata?.totalPages ?? 1,
      }));
    } catch (e) {
      const message = e instanceof ApiError ? e.message : "Failed to load vehicles";
      set({ vehiclesError: message, vehiclesLoading: false });
    }
  },

  importVehicles: async (vehicles) => {
    const data = await apiPost<VehicleBulkImportResult>("/api/vehicles/bulk", {
      vehicles,
    });
    if (data.created.length > 0) {
      set((state) => ({ vehicles: [...data.created, ...state.vehicles] }));
    }
    return data;
  },

  addVehicle: async (vehicle) => {
    try {
      const data = await apiPost<{ vehicle: Vehicle }>("/api/vehicles", vehicle);
      set((state) => ({
        vehicles: [data.vehicle, ...state.vehicles.filter((v) => v.id !== vehicle.id)],
      }));
      return data.vehicle;
    } catch (e) {
      console.error("Failed to add vehicle via API:", e);
      return null;
    }
  },

  updateVehicle: async (id, updates) => {
    try {
      const data = await apiPut<{ vehicle: Vehicle }>(`/api/vehicles/${id}`, updates);
      set((state) => ({
        vehicles: state.vehicles.map((v) => (v.id === id ? data.vehicle : v)),
      }));
      return data.vehicle;
    } catch (e) {
      console.error("Failed to update vehicle via API:", e);
      return null;
    }
  },

  deleteVehicle: async (id) => {
    try {
      await apiDelete<{ ok: boolean }>(`/api/vehicles/${id}`);
      set((state) => ({
        vehicles: state.vehicles.filter((v) => v.id !== id),
      }));
      return true;
    } catch (e) {
      console.error("Failed to delete vehicle via API:", e);
      return false;
    }
  },
}));
