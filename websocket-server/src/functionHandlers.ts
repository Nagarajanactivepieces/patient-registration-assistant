import { FunctionHandler } from "./types";
import fetch from "node-fetch";

const functions: FunctionHandler[] = [];

functions.push({
  schema: {
    name: "get_patient_basic_information",
    type: "function",
    description: "Collect basic patient information",
    parameters: {
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
  },
  handler: async (args: {
    FirstName: string;
    LastName: string;
    DateOfBirth: string;
    SSN: string;
    EmailID: string;
    MaritalStatus: string;
    PhoneNumber: string;
  }) => {
    try {
      console.log("📥 Received patient info:", args); // log input arguments

      const response = await fetch(
        "https://deployment.tekclansolutions.com:8443/prweb/api/Users/v1/CreatePatient",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(args),
        }
      );

      console.log("🌐 API Response Status:", response.status);

      const result = await response.json();
      console.log("✅ API Response Body:", result);

      return JSON.stringify({ status: "posted", result });
    } catch (error: any) {
      console.error("❌ Error posting patient info:", error.message);
      return JSON.stringify({ error: error.message });
    }
  },
});

export default functions;
