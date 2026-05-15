export type Role = "Founder" | "CEO" | "HR" | "Finance" | "Sales" | "Operations" | "Employee";

export type AuthUser = {
  _id: string;
  name: string;
  email: string;
  role: Role;
};

