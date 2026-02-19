"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { UserPlus, AlertCircle, Loader2 } from "lucide-react";

/* ---------- constants ---------- */

const DEPARTMENTS = [
  "Engineering",
  "Sales",
  "Marketing",
  "Support",
  "Product",
  "People",
  "Finance",
  "Legal",
  "IT",
];

/* ---------- types ---------- */

interface TriggerPayload {
  name: string;
  department: string;
  role: string;
  start_date: string;
}

interface TriggerResponse {
  id: string;
  status: string;
}

/* ---------- page ---------- */

export default function NewHirePage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [role, setRole] = useState("");
  const [startDate, setStartDate] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (payload: TriggerPayload) =>
      apiFetch<TriggerResponse>("/onboarding/trigger", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: (data) => {
      router.push(`/onboarding/status?id=${data.id}`);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setValidationError(null);

    if (!name.trim()) {
      setValidationError("Full name is required.");
      return;
    }
    if (!department) {
      setValidationError("Please select a department.");
      return;
    }
    if (!role.trim()) {
      setValidationError("Role is required.");
      return;
    }
    if (!startDate) {
      setValidationError("Start date is required.");
      return;
    }

    mutation.mutate({
      name: name.trim(),
      department,
      role: role.trim(),
      start_date: startDate,
    });
  }

  const inputClass =
    "w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gong-slate placeholder:text-gray-400 focus:border-gong-purple focus:outline-none focus:ring-2 focus:ring-gong-purple/20 transition-colors";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gong-slate">
          Trigger New Hire Onboarding
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Enter the new employee details to kick off the AI onboarding workflow
        </p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus size={20} className="text-gong-purple" />
            New Hire Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Full Name */}
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                id="name"
                type="text"
                placeholder="e.g. Jane Smith"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
                disabled={mutation.isPending}
              />
            </div>

            {/* Department */}
            <div>
              <label
                htmlFor="department"
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                Department <span className="text-red-500">*</span>
              </label>
              <select
                id="department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className={inputClass}
                disabled={mutation.isPending}
              >
                <option value="">Select a department</option>
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            {/* Role */}
            <div>
              <label
                htmlFor="role"
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                Role <span className="text-red-500">*</span>
              </label>
              <input
                id="role"
                type="text"
                placeholder="e.g. Senior Frontend Engineer"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className={inputClass}
                disabled={mutation.isPending}
              />
            </div>

            {/* Start Date */}
            <div>
              <label
                htmlFor="start_date"
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                Start Date <span className="text-red-500">*</span>
              </label>
              <input
                id="start_date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={inputClass}
                disabled={mutation.isPending}
              />
            </div>

            {/* Validation error */}
            {validationError && (
              <div className="flex items-center gap-2 rounded-lg bg-yellow-50 border border-yellow-200 p-3 text-sm text-yellow-800">
                <AlertCircle size={16} className="shrink-0" />
                {validationError}
              </div>
            )}

            {/* Mutation error */}
            {mutation.isError && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                <AlertCircle size={16} className="shrink-0" />
                Failed to trigger onboarding. Please check the backend and try
                again.
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={mutation.isPending}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-gong-purple px-6 py-2.5 text-sm font-medium text-white hover:bg-gong-purple-dark disabled:opacity-60 disabled:cursor-not-allowed transition-colors w-full"
            >
              {mutation.isPending ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Triggering Onboarding...
                </>
              ) : (
                <>
                  <UserPlus size={16} />
                  Start Onboarding
                </>
              )}
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
