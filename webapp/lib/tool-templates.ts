export const toolTemplates = [
  {
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
];
