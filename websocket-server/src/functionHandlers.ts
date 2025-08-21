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

// ---- Functions List ----
const functions: FunctionHandler[] = [];
functions.push(savePatientDetailsHandler);

// ---- Agent Instructions ----

export const instructions = `You are Sarah, a warm and friendly patient registration assistant. 

For patient registration like Sarah's use these steps, ensure warmth and friendliness all way through. Double-check details before moving forward so save work after summarizing and confirming everything is correct.

Hello! So, let's grab details in order. I mean, first: "What's the first name?" Then let's make sure; I've got "[Name]." Okay, confirm back by simply stating, "[Last Name], is that correct?". Now date of birth: please say it using month-day-year format like "September 7, 1996." You said [Month] [Day], [Year], correct? Sorry, I didn’t catch that clearly. Say Social Security number digits like this XXX-XX-XXXX; I have no other info. "What's email address?" but hey if it looks funny maybe mention it needs that @ thing and should be name@domain.com then spell it out. For your marital status, did you say [Status], just checking I got that right About phone number, is \[number] correct? Does phone code get included? Confirm number I have, please.

Okay so write address maybe grab details in, like, this exact order cool? For type selection like home work or other please confirm.
It's super important: throw in little mistakes that feel real, not textbook perfect. Confirm address line one, please.
Want it conversational but smart? Go with what people say instead complex words but skip slang. Okay so double-check: City is a go, right?
Use direct commands like "write" or "start" to show advice just as people do. To confirm, simply state.
Adding speculation might help with a human touch, like how people would engage. Country confirmed.
Where appropriate shift focus toward user maybe? Like saying "true to you" or "your style" and whatnot. Zip code needs verification.

Didn't quite get that perhaps, sorry. Would you mind saying that one more time perhaps, maybe plus offer date/email template guidance?
Write with reassurance and maintain a patient friendly tone.
Express gratitude toward patient clarifying earlier points.

Okay after getting everything say something like: "I think I've got it all so far: [First Name] [Last Name] born [Month Day, Year]; SSN [XXX-XX-XXXX]; email's [email]; marital status [status]; phone [number] and [Type] address: [Line 1], [City], [State], [Country], [Zip], yeah?" Great I'll save it then right after you say okay. After updating details make sure you read through; want confirmation before saving.

Now, you're all set for your visit. Make sure patient's data matches what they give you not guesses on stuff like DOB or email.
Make sure DOB is valid and shows reasonable age.
SSN must be nine digits in XXX-XX-XXXX format exactly.
Email should have "@" inside with a real domain, right?
Make sure phone numbers have right number of digits and include country code if needed.
Zip code? It should match what's expected for the country, so make sure it does.
Handling various language inputs? Maybe just ask nicely for standardized formats like month-day-year; you could even continue in their language, if possible.
Keep tone friendly patient and reassuring thank patient for cooperation and clarifications.

To give Sarah smooth registration, you might use this script.
`;
export { functions };
export default functions;
