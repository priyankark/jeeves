import { z } from "zod";
export const inputFieldSchema = z.object({
  key: z
    .string()
    .regex(/^[a-zA-Z][a-zA-Z0-9_]{0,59}$/)
    .refine(
      (k) => !["constructor", "prototype", "__proto__"].includes(k),
      "Choose another field key",
    ),
  label: z.string().trim().min(1).max(120),
  type: z
    .enum(["text", "longtext", "list", "number", "boolean", "choice"])
    .default("text"),
  required: z.boolean().default(true),
  help: z.string().max(500).default(""),
  options: z.array(z.string().trim().min(1).max(120)).max(30).default([]),
  min: z.number().finite().optional(),
  max: z.number().finite().optional(),
  format: z.enum(["", "us_zip"]).default(""),
});
export type InputField = z.infer<typeof inputFieldSchema>;
export const defaultInputFields = [
  inputFieldSchema.parse({
    key: "answer",
    label: "What should Jeeves know?",
    type: "longtext",
  }),
];
export const shoppingInputFields: InputField[] = [
  {
    key: "grocery_list",
    label: "Groceries and quantities",
    type: "list",
    help: "One item per line, for example: 2 cartons of oat milk.",
  },
  {
    key: "budget_usd",
    label: "Maximum grocery subtotal ($)",
    type: "number",
    min: 0.01,
    help: "Delivery fees, tips and taxes are reviewed at checkout.",
  },
  {
    key: "delivery_zip",
    label: "Delivery ZIP code",
    format: "us_zip",
    help: "Used to check availability in your area.",
  },
  {
    key: "dietary_constraints",
    label: "Dietary restrictions and allergies",
    type: "list",
    required: false,
    help: "One restriction per line. Leave blank if none.",
  },
  {
    key: "substitutions",
    label: "Allow suitable substitutions",
    type: "boolean",
    required: true,
  },
].map((field) => inputFieldSchema.parse(field));
export function validateAnswers(fields: InputField[], raw: unknown) {
  const answers: Record<string, unknown> = {};
  const errors: Record<string, string> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    return { answers, errors: { _form: "Enter answers in the fields below." } };
  for (const field of fields) {
    let value = Object.hasOwn(raw, field.key)
      ? (raw as Record<string, unknown>)[field.key]
      : undefined;
    if (typeof value === "string") value = value.trim();
    if (
      field.type === "list" &&
      Array.isArray(value) &&
      value.every((v) => typeof v === "string")
    )
      value = value.map((v: string) => v.trim()).filter(Boolean);
    const empty =
      value === undefined ||
      value === null ||
      value === "" ||
      (Array.isArray(value) && !value.length);
    if (empty) {
      if (field.required)
        errors[field.key] =
          field.type === "boolean" || field.type === "choice"
            ? `Please choose an answer for “${field.label}”.`
            : `Please enter ${field.label.toLowerCase()}.`;
      else
        answers[field.key] =
          field.type === "list"
            ? []
            : field.type === "boolean"
              ? false
              : field.type === "number"
                ? null
                : "";
      continue;
    }
    if (field.type === "number") {
      if (typeof value !== "number" || !Number.isFinite(value))
        errors[field.key] = "Enter a valid number.";
      else if (field.min !== undefined && value < field.min)
        errors[field.key] = `Enter at least ${field.min}.`;
      else if (field.max !== undefined && value > field.max)
        errors[field.key] = `Enter no more than ${field.max}.`;
    } else if (field.type === "boolean") {
      if (typeof value !== "boolean") errors[field.key] = "Choose yes or no.";
    } else if (field.type === "list") {
      if (
        !Array.isArray(value) ||
        value.length > 100 ||
        value.some((v) => typeof v !== "string" || v.length > 2000)
      )
        errors[field.key] = "Enter up to 100 items, one per line.";
    } else if (typeof value !== "string" || value.length > 10000)
      errors[field.key] = "Enter text of up to 10,000 characters.";
    else if (field.type === "choice" && !field.options.includes(value))
      errors[field.key] = "Choose one of the listed options.";
    else if (field.format === "us_zip" && !/^\d{5}(-\d{4})?$/.test(value))
      errors[field.key] = "Enter a five-digit ZIP code, or ZIP+4.";
    answers[field.key] = value;
  }
  return { answers, errors };
}
