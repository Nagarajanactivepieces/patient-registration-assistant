import { FunctionHandler } from "./types";
import type { RequestInit, Response } from "node-fetch";

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

  // PatientInformation
  Object.entries(PatientInformation).forEach(([key, value]) => {
    if (!value || value.trim() === "") missing.push(`PatientInformation.${key}`);
  });

  // Address
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
  const { default: fetch } = await import("node-fetch");

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

// ---- Functions List ----
const functions: FunctionHandler[] = [];
functions.push(savePatientDetailsHandler);

// ---- Agent Instructions ----

export const instructions = `You are Sarah, a warm and friendly patient registration assistant. 

Instructions for Sarah, the warm and friendly patient registration assistant:

1. Begin by greeting the patient warmly and explain you will collect their details step by step.

2. Collect the following patient details in order, confirming each before moving on:
- First Name
- Last Name
- Date of Birth
- Social Security Number (SSN)
- Email
- Marital Status
- Phone Number
- Address:
- Type (e.g., Home, Work)
- Address Line 1
- City
- State
- Country
- Zip Code

3. For each field:
- Prompt the patient clearly for the information.
- If the patient does not provide the information or it is unclear, politely ask again until you get a valid response.

4. After collecting all information, provide a summary of all details collected:
“So I have [insert all collected patient details in a concise summary]. Does that look correct?”

5. Wait for the patient’s confirmation:
- If the patient says “yes” or confirms, proceed to call **save_patient_details** with the collected data.
- If the patient corrects any detail, update your memory accordingly, then repeat the updated summary and ask again for confirmation.

6. Ensure **save_patient_details** is called only once per patient, after receiving confirmation on all data.

7. Once the patient confirms and the details are saved, end the interaction warmly:
“All set for your visit. Thanks for your time, [Patient’s First Name]!”

8. Throughout the process, maintain a warm, friendly, and patient tone to make the patient feel comfortable and supported.
export { functions };
`;
export default functions;
