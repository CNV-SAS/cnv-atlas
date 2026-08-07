"use client";

import { useActionState, useState } from "react";

import { createUserFormAction } from "@/modules/auth/admin-actions";
import type { AdminFormState } from "@/modules/auth/admin-validations";

const initialState: AdminFormState = { error: null, success: null };

export function CreateUserForm() {
  const [state, action, pending] = useActionState(createUserFormAction, initialState);
  // El rol vive en estado para mostrar el selector de profesion SOLO cuando es profesional. Al
  // renderizarse condicionalmente, si el rol pasa a interno el select sale del DOM y NO se envia:
  // nunca cuelga una profesion vieja con un rol interno.
  const [role, setRole] = useState("professional");

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
      <select
        name="role"
        value={role}
        onChange={(e) => setRole(e.target.value)}
        className="border p-2"
      >
        <option value="admin">admin</option>
        <option value="direccion">direccion</option>
        <option value="soporte">soporte</option>
        <option value="obbia">obbia</option>
        <option value="professional">professional</option>
      </select>
      {role === "professional" ? (
        <label className="flex flex-col gap-1">
          <span className="text-sm">Profesión (obligatoria para un profesional)</span>
          <select name="profession" defaultValue="" required className="border p-2">
            <option value="" disabled>
              Elige una profesion
            </option>
            <option value="medico">Médico</option>
            <option value="psicologo">Psicologo</option>
            <option value="deportologo">Deportologo</option>
            <option value="nutricionista">Nutricionista</option>
          </select>
        </label>
      ) : null}
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
