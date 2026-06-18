"use client";

import { useActionState } from "react";

import { createUserFormAction } from "@/modules/auth/admin-actions";
import type { AdminFormState } from "@/modules/auth/admin-validations";

const initialState: AdminFormState = { error: null, success: null };

export function CreateUserForm() {
  const [state, action, pending] = useActionState(createUserFormAction, initialState);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input name="email" type="email" placeholder="correo" required className="border p-2" />
      <input
        name="fullName"
        type="text"
        placeholder="nombre completo"
        required
        className="border p-2"
      />
      <select name="role" defaultValue="professional" className="border p-2">
        <option value="admin">admin</option>
        <option value="direccion">direccion</option>
        <option value="soporte">soporte</option>
        <option value="obbia">obbia</option>
        <option value="professional">professional</option>
      </select>
      {state.error ? (
        <p role="alert" className="text-red-600">
          {state.error}
        </p>
      ) : null}
      {state.success ? <p className="text-green-700">{state.success}</p> : null}
      <button type="submit" disabled={pending} className="border p-2">
        {pending ? "Creando..." : "Crear e invitar"}
      </button>
    </form>
  );
}
