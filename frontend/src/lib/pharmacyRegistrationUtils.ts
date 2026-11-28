import type { ApiError } from "../types/api.ts";

export interface PharmacyRegistrationFormInput {
  name: string;
  licenseNumber: string;
  phone: string;
  email: string;
  password: string;
  address: string;
  area: string;
  city: string;
  state: string;
  pincode: string;
  lat: string;
  lng: string;
  tier: "standard" | "hub" | "hospital_attached";
  is24x7: boolean;
}

export type PharmacyRegistrationFormErrors = Partial<
  Record<keyof PharmacyRegistrationFormInput, string>
>;

const INDIAN_PINCODE_REGEX = /^[1-9][0-9]{5}$/;
const LICENSE_NUMBER_REGEX = /^[A-Za-z0-9\-\/\s]{4,100}$/;

/**
 * Validates registration fields against Person B's selfRegisterPharmacySchema
 * (POST /api/v1/pharmacies/register).
 */
export function validatePharmacyRegistrationForm(
  input: PharmacyRegistrationFormInput,
  options: { requireAccountCredentials: boolean }
): PharmacyRegistrationFormErrors {
  const errors: PharmacyRegistrationFormErrors = {};

  if (input.name.trim().length < 2) {
    errors.name = "Pharmacy name must be at least 2 characters.";
  }

  if (!LICENSE_NUMBER_REGEX.test(input.licenseNumber.trim())) {
    errors.licenseNumber =
      "Valid drug license number (4-100 alphanumeric characters) is required.";
  }

  if (input.phone.trim().length < 7) {
    errors.phone = "Enter a valid contact phone number (at least 7 digits).";
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
    errors.email = "Enter a valid manager email address.";
  }

  if (input.address.trim().length < 5) {
    errors.address = "Street address must be at least 5 characters.";
  }

  if (input.area.trim().length < 2) {
    errors.area = "Area / locality must be at least 2 characters.";
  }

  if (input.city.trim().length < 2) {
    errors.city = "City must be at least 2 characters.";
  }

  if (input.state.trim().length < 2) {
    errors.state = "State must be at least 2 characters.";
  }

  if (!INDIAN_PINCODE_REGEX.test(input.pincode.trim())) {
    errors.pincode = "Must be a valid 6-digit Indian PIN code.";
  }

  if (input.lat.trim() !== "") {
    const latNum = Number(input.lat);
    if (Number.isNaN(latNum) || latNum < -90 || latNum > 90) {
      errors.lat = "Enter a valid latitude (-90 to 90).";
    }
  }

  if (input.lng.trim() !== "") {
    const lngNum = Number(input.lng);
    if (Number.isNaN(lngNum) || lngNum < -180 || lngNum > 180) {
      errors.lng = "Enter a valid longitude (-180 to 180).";
    }
  }

  if (options.requireAccountCredentials) {
    if (input.password.length < 8 || input.password.length > 128) {
      errors.password = "Password must be between 8 and 128 characters.";
    }
  }

  return errors;
}

/**
 * Maps backend VALIDATION_ERROR details ([{ path, message }]) into form field errors.
 */
export function mapApiDetailsToRegistrationErrors(
  apiError: Partial<ApiError>
): PharmacyRegistrationFormErrors {
  const mapped: PharmacyRegistrationFormErrors = {};
  if (!Array.isArray(apiError.details)) return mapped;

  for (const d of apiError.details as Array<{
    path?: string;
    message?: string;
  }>) {
    if (!d?.path || !d?.message) continue;
    const key = d.path.replace(/^location\./, "") as keyof PharmacyRegistrationFormInput;
    mapped[key] = d.message;
  }

  return mapped;
}
