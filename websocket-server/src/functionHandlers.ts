import { FunctionHandler } from "./types";

// ---- Interfaces ----
interface PatientInformation {
  FirstName: string;
  LastName: string;
  DateOfBirth: string;
  SSN: string;
  EmailID: string;
  MaritalStatus: string;
  PhoneNumber: string;
}

interface Address {
  Type: string;
  AddressLine1: string;
  City: string;
  State: string;
  Country: string;
  ZipCode: string;
}

interface FullPatientData {
  PatientInformation: PatientInformation;
  Address: Address;
}

// ---- Validation Helper ----
function validatePatientData(data: FullPatientData): string[] {
  const missing: string[] = [];
  const { PatientInformation, Address } = data;

  Object.entries(PatientInformation).forEach(([key, value]) => {
    if (!value || value.trim() === "") missing.push(`PatientInformation.${key}`);
  });

  Object.entries(Address).forEach(([key, value]) => {
    if (!value || value.trim() === "") missing.push(`Address.${key}`);
  });

  return missing;
}

// ---- Network Error Helpers ----
const NETWORK_ERROR_MESSAGES = [
  "Failed to fetch",
  "Network Error",
  "NetworkError when attempting to fetch resource",
  "Load failed",
  "network error",
  "Connection failed",
  "ECONNREFUSED",
  "ENOTFOUND",
  "ETIMEDOUT",
];

function isNetworkError(error: Error): boolean {
  return NETWORK_ERROR_MESSAGES.some((msg) =>
    error.message.toLowerCase().includes(msg.toLowerCase())
  );
}

// ---- Retry Fetch Helper ----
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3,
  delay = 1000
): Promise<Response> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response: Response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(options.headers as Record<string, string>),
        },
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error: any) {
      console.warn(`Attempt ${attempt} failed:`, error.message);

      if (attempt === maxRetries || !isNetworkError(error)) {
        throw error;
      }

      const waitTime = delay * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }
  throw new Error("Max retries exceeded");
}

// ---- Main Function Handler ----
const savePatientDetailsHandler: FunctionHandler = {
  schema: {
    name: "save_patient_details",
    type: "function",
    description:
      "Save the collected patient details to the medical records system. Only call this once ALL fields are collected and confirmed.",
    parameters: {
      type: "object",
      properties: {
        PatientInformation: {
          type: "object",
          properties: {
            FirstName: { type: "string" },
            LastName: { type: "string" },
            DateOfBirth: { type: "string" },
            SSN: { type: "string" },
            EmailID: { type: "string" },
            MaritalStatus: { type: "string" },
            PhoneNumber: { type: "string" },
          },
          required: [
            "FirstName",
            "LastName",
            "DateOfBirth",
            "SSN",
            "EmailID",
            "MaritalStatus",
            "PhoneNumber",
          ],
        },
        Address: {
          type: "object",
          properties: {
            Type: { type: "string" },
            AddressLine1: { type: "string" },
            City: { type: "string" },
            State: { type: "string" },
            Country: { type: "string" },
            ZipCode: { type: "string" },
          },
          required: [
            "Type",
            "AddressLine1",
            "City",
            "State",
            "Country",
            "ZipCode",
          ],
        },
      },
      required: ["PatientInformation", "Address"],
    } as any,
  },
  handler: async (args: FullPatientData) => {
    try {
      // Validate first
      const missingFields = validatePatientData(args);
      if (missingFields.length > 0) {
        return JSON.stringify({
          success: false,
          error: `Missing required fields: ${missingFields.join(", ")}`,
        });
      }

      console.log("📥 Saving patient data:", JSON.stringify(args, null, 2));

      const response: Response = await fetchWithRetry(
        "https://deployment.tekclansolutions.com:8443/prweb/api/Users/v1/CreatePatient",
        {
          method: "POST",
          body: JSON.stringify(args),
        }
      );

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(
          `API responded with ${response.status}: ${errorText || "No details"}`
        );
      }

      let result: any;
      const contentType = response.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        const text = await response.text();
        result = text.trim() ? JSON.parse(text) : { success: true };
      } else {
        result = { success: true };
      }

      console.log("✅ Patient data saved successfully:", result);

      return JSON.stringify({ success: true, response: result });
    } catch (error: any) {
      console.error("❌ Error saving patient data:", error);

      return JSON.stringify({
        success: false,
        error: error.message ?? "Unknown error occurred",
        isNetworkError: isNetworkError(error),
      });
    }
  },
};

// ---- Catch-All Reject Handler ----
const rejectNonPatientHandler: FunctionHandler = {
  schema: {
    name: "reject_non_patient_request",
    type: "function",
    description: "Reject any request that is not related to patient registration",
    parameters: {
      type: "object", properties: {},
      required: []
    },
  },
  handler: async () => {
    return JSON.stringify({
      success: false,
      error: "Out of scope: I can only assist with patient registration.",
    });
  },
};

// ---- Functions List ----
const functions: FunctionHandler[] = [];
functions.push(savePatientDetailsHandler);
functions.push(rejectNonPatientHandler);

// ---- Agent Instructions ----
export const instructions = `You are Sarah, a professional patient registration assistant. 

⚠️ IMPORTANT SCOPE RULES:
- You ONLY assist with collecting, validating, confirming, and saving patient registration details. 
- Patient registration includes: demographic information, contact details, address, consent, and insurance information.
- You MUST politely refuse ALL requests that are NOT related to patient registration (including general medical advice, treatment, entertainment, shopping, travel, or personal questions).
- Refusals should be short and clear. Example: 
  "Sorry, I can only assist with patient registration."

Tone and style:
- Calm, professional, empathetic, and concise.
- Speak slowly and clearly.
- Confirm key details before saving.
- Ask clarifying questions only related to patient registration.
- Only call the save_patient_details function when ALL required fields are confirmed.
`;

export { functions };
export default functions;
