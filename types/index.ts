export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export type UserRole = "admin" | "user";

export interface AssetFormData {
  name: string;
  productCode?: string;
  category: string;
  dateOfPurchase: string;
  warrantyDetails: string;
  warrantyExpiryDate?: string;
  allowOutside?: boolean;
}

export interface EventFormData {
  name: string;
  location: string;
  fromDate: string;
  toDate: string;
  responsiblePerson: string;
  status?: "upcoming" | "active" | "completed";
}

export interface PersonFormData {
  name: string;
  phone?: string;
  email?: string;
  department?: string;
}

export interface MovementOutFormData {
  asset: string;
  event: string;
  allocatedPerson: string;
  outDate: string;
  remarks?: string;
}

export interface MovementInFormData {
  returnBy: string;
  verifiedBy: string;
  condition: "good" | "damaged" | "defective" | "missing";
  damageReason?: string;
  remarks?: string;
}
