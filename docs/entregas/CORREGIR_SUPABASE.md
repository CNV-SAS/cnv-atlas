Security Advisor:
1.
"Errors

[
  {
    "name": "security_definer_view",
    "title": "Security Definer View",
    "level": "ERROR",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects views defined with the SECURITY DEFINER property. These views enforce Postgres permissions and row level security policies (RLS) of the view creator, rather than that of the querying user",
    "detail": "View \\`public.combinaciones_bajo_umbral\\` is defined with the SECURITY DEFINER property",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view",
    "metadata": {
      "schema": "public",
      "name": "combinaciones_bajo_umbral",
      "type": "view"
    },
    "cache_key": "security_definer_view_public_combinaciones_bajo_umbral",
    "observed_at": "2026-09-29T23:22:56.457Z"
  },
  {
    "name": "rls_disabled_in_public",
    "title": "RLS Disabled in Public",
    "level": "ERROR",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects cases where row level security (RLS) has not been enabled on tables in schemas exposed to PostgREST",
    "detail": "Table \\`public.commission_settlements\\` is public, but RLS has not been enabled.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public",
    "metadata": {
      "schema": "public",
      "name": "commission_settlements",
      "type": "table"
    },
    "cache_key": "rls_disabled_in_public_public_commission_settlements",
    "observed_at": "2026-09-29T23:22:56.457Z"
  },
  {
    "name": "rls_disabled_in_public",
    "title": "RLS Disabled in Public",
    "level": "ERROR",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects cases where row level security (RLS) has not been enabled on tables in schemas exposed to PostgREST",
    "detail": "Table \\`public.professional_modalities\\` is public, but RLS has not been enabled.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public",
    "metadata": {
      "schema": "public",
      "name": "professional_modalities",
      "type": "table"
    },
    "cache_key": "rls_disabled_in_public_public_professional_modalities",
    "observed_at": "2026-09-29T23:22:56.457Z"
  },
  {
    "name": "rls_disabled_in_public",
    "title": "RLS Disabled in Public",
    "level": "ERROR",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects cases where row level security (RLS) has not been enabled on tables in schemas exposed to PostgREST",
    "detail": "Table \\`public.professional_attachments\\` is public, but RLS has not been enabled.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public",
    "metadata": {
      "schema": "public",
      "name": "professional_attachments",
      "type": "table"
    },
    "cache_key": "rls_disabled_in_public_public_professional_attachments",
    "observed_at": "2026-09-29T23:22:56.457Z"
  }
]

"

2. Warnings:
"[
  {
    "name": "function_search_path_mutable",
    "title": "Function Search Path Mutable",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects functions where the search_path parameter is not set.",
    "detail": "Function \\`public.set_updated_at\\` has a role mutable search_path",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable",
    "metadata": {
      "schema": "public",
      "name": "set_updated_at",
      "type": "function"
    },
    "cache_key": "function_search_path_mutable_public_set_updated_at_abc24736eedbd3caddc31fa9ffa658a6",
    "observed_at": "2026-09-29T23:24:15.779Z"
  },
  {
    "name": "function_search_path_mutable",
    "title": "Function Search Path Mutable",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects functions where the search_path parameter is not set.",
    "detail": "Function \\`public.prevent_audit_mutation\\` has a role mutable search_path",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable",
    "metadata": {
      "schema": "public",
      "name": "prevent_audit_mutation",
      "type": "function"
    },
    "cache_key": "function_search_path_mutable_public_prevent_audit_mutation_c7a023348b65b115fbe7aff384ad8fb9",
    "observed_at": "2026-09-29T23:24:15.779Z"
  },
  {
    "name": "function_search_path_mutable",
    "title": "Function Search Path Mutable",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects functions where the search_path parameter is not set.",
    "detail": "Function \\`public.prevent_report_snapshot_mutation\\` has a role mutable search_path",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable",
    "metadata": {
      "schema": "public",
      "name": "prevent_report_snapshot_mutation",
      "type": "function"
    },
    "cache_key": "function_search_path_mutable_public_prevent_report_snapshot_mutation_0eeabf46e8b33bd583613cbde45e3019",
    "observed_at": "2026-09-29T23:24:15.779Z"
  },
  {
    "name": "function_search_path_mutable",
    "title": "Function Search Path Mutable",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects functions where the search_path parameter is not set.",
    "detail": "Function \\`public.treatments_immutability\\` has a role mutable search_path",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable",
    "metadata": {
      "schema": "public",
      "name": "treatments_immutability",
      "type": "function"
    },
    "cache_key": "function_search_path_mutable_public_treatments_immutability_7342e01463ed88afc696eedf489b0f34",
    "observed_at": "2026-09-29T23:24:15.779Z"
  },
  {
    "name": "function_search_path_mutable",
    "title": "Function Search Path Mutable",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects functions where the search_path parameter is not set.",
    "detail": "Function \\`public.diagnoses_confirmation_immutability\\` has a role mutable search_path",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable",
    "metadata": {
      "schema": "public",
      "name": "diagnoses_confirmation_immutability",
      "type": "function"
    },
    "cache_key": "function_search_path_mutable_public_diagnoses_confirmation_immutability_339f64a1b614fae824d39d9ba695dd4c",
    "observed_at": "2026-09-29T23:24:15.779Z"
  },
  {
    "name": "function_search_path_mutable",
    "title": "Function Search Path Mutable",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects functions where the search_path parameter is not set.",
    "detail": "Function \\`public.clinical_corrections_guard\\` has a role mutable search_path",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable",
    "metadata": {
      "schema": "public",
      "name": "clinical_corrections_guard",
      "type": "function"
    },
    "cache_key": "function_search_path_mutable_public_clinical_corrections_guard_eff3c7d2b5704334ae01c4fa3e4d6a38",
    "observed_at": "2026-09-29T23:24:15.779Z"
  },
  {
    "name": "function_search_path_mutable",
    "title": "Function Search Path Mutable",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects functions where the search_path parameter is not set.",
    "detail": "Function \\`public.clinical_corrections_apply\\` has a role mutable search_path",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable",
    "metadata": {
      "schema": "public",
      "name": "clinical_corrections_apply",
      "type": "function"
    },
    "cache_key": "function_search_path_mutable_public_clinical_corrections_apply_07c13b294fcedaa450ab3e5fe74f1cc8",
    "observed_at": "2026-09-29T23:24:15.779Z"
  },
  {
    "name": "function_search_path_mutable",
    "title": "Function Search Path Mutable",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects functions where the search_path parameter is not set.",
    "detail": "Function \\`public.clinical_corrections_append_only\\` has a role mutable search_path",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable",
    "metadata": {
      "schema": "public",
      "name": "clinical_corrections_append_only",
      "type": "function"
    },
    "cache_key": "function_search_path_mutable_public_clinical_corrections_append_only_1048743af89a96fc249187bce2369a13",
    "observed_at": "2026-09-29T23:24:15.779Z"
  },
  {
    "name": "function_search_path_mutable",
    "title": "Function Search Path Mutable",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects functions where the search_path parameter is not set.",
    "detail": "Function \\`public.evaluations_superseded_coherence\\` has a role mutable search_path",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable",
    "metadata": {
      "schema": "public",
      "name": "evaluations_superseded_coherence",
      "type": "function"
    },
    "cache_key": "function_search_path_mutable_public_evaluations_superseded_coherence_d334467fb8f742395aeedc43e83660dc",
    "observed_at": "2026-09-29T23:24:15.779Z"
  },
  {
    "name": "function_search_path_mutable",
    "title": "Function Search Path Mutable",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects functions where the search_path parameter is not set.",
    "detail": "Function \\`public.nutra_movement_append_only\\` has a role mutable search_path",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable",
    "metadata": {
      "schema": "public",
      "name": "nutra_movement_append_only",
      "type": "function"
    },
    "cache_key": "function_search_path_mutable_public_nutra_movement_append_only_a4db6f45cff3920de69c68cc3127fff8",
    "observed_at": "2026-09-29T23:24:15.779Z"
  },
  {
    "name": "function_search_path_mutable",
    "title": "Function Search Path Mutable",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects functions where the search_path parameter is not set.",
    "detail": "Function \\`public.nutra_faltante_transition_append_only\\` has a role mutable search_path",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable",
    "metadata": {
      "schema": "public",
      "name": "nutra_faltante_transition_append_only",
      "type": "function"
    },
    "cache_key": "function_search_path_mutable_public_nutra_faltante_transition_append_only_f9ebef22578894d3c1f2cd7630601b1c",
    "observed_at": "2026-09-29T23:24:15.779Z"
  },
  {
    "name": "function_search_path_mutable",
    "title": "Function Search Path Mutable",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects functions where the search_path parameter is not set.",
    "detail": "Function \\`public.nutra_count_append_only\\` has a role mutable search_path",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable",
    "metadata": {
      "schema": "public",
      "name": "nutra_count_append_only",
      "type": "function"
    },
    "cache_key": "function_search_path_mutable_public_nutra_count_append_only_a36edf23261780ec93c6c3506bb886b7",
    "observed_at": "2026-09-29T23:24:15.779Z"
  },
  {
    "name": "function_search_path_mutable",
    "title": "Function Search Path Mutable",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects functions where the search_path parameter is not set.",
    "detail": "Function \\`public.referrals_immutable\\` has a role mutable search_path",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable",
    "metadata": {
      "schema": "public",
      "name": "referrals_immutable",
      "type": "function"
    },
    "cache_key": "function_search_path_mutable_public_referrals_immutable_537d51f78f02e46f77354d450c8c71b1",
    "observed_at": "2026-09-29T23:24:15.779Z"
  },
  {
    "name": "function_search_path_mutable",
    "title": "Function Search Path Mutable",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects functions where the search_path parameter is not set.",
    "detail": "Function \\`public.prescription_emissions_immutability\\` has a role mutable search_path",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable",
    "metadata": {
      "schema": "public",
      "name": "prescription_emissions_immutability",
      "type": "function"
    },
    "cache_key": "function_search_path_mutable_public_prescription_emissions_immutability_c34b19e0411558201a06e17d5dd8508a",
    "observed_at": "2026-09-29T23:24:15.779Z"
  },
  {
    "name": "function_search_path_mutable",
    "title": "Function Search Path Mutable",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects functions where the search_path parameter is not set.",
    "detail": "Function \\`public.prevent_soap_note_mutation\\` has a role mutable search_path",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable",
    "metadata": {
      "schema": "public",
      "name": "prevent_soap_note_mutation",
      "type": "function"
    },
    "cache_key": "function_search_path_mutable_public_prevent_soap_note_mutation_f3b8b249b785ec218956c76142b2e3b3",
    "observed_at": "2026-09-29T23:24:15.779Z"
  },
  {
    "name": "function_search_path_mutable",
    "title": "Function Search Path Mutable",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects functions where the search_path parameter is not set.",
    "detail": "Function \\`public.commission_settlement_paid_immutable\\` has a role mutable search_path",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable",
    "metadata": {
      "schema": "public",
      "name": "commission_settlement_paid_immutable",
      "type": "function"
    },
    "cache_key": "function_search_path_mutable_public_commission_settlement_paid_immutable_95aa6d1d74343641585d9e054effd200",
    "observed_at": "2026-09-29T23:24:15.779Z"
  },
  {
    "name": "function_search_path_mutable",
    "title": "Function Search Path Mutable",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects functions where the search_path parameter is not set.",
    "detail": "Function \\`public.lot_expiry_alerts_solo_vista\\` has a role mutable search_path",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable",
    "metadata": {
      "schema": "public",
      "name": "lot_expiry_alerts_solo_vista",
      "type": "function"
    },
    "cache_key": "function_search_path_mutable_public_lot_expiry_alerts_solo_vista_a77b0a0c3b99ba37173d55beefe7a1a0",
    "observed_at": "2026-09-29T23:24:15.779Z"
  },
  {
    "name": "function_search_path_mutable",
    "title": "Function Search Path Mutable",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects functions where the search_path parameter is not set.",
    "detail": "Function \\`public.nutra_returns_solo_cierre\\` has a role mutable search_path",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable",
    "metadata": {
      "schema": "public",
      "name": "nutra_returns_solo_cierre",
      "type": "function"
    },
    "cache_key": "function_search_path_mutable_public_nutra_returns_solo_cierre_53d14b910a3ad5ba46f24fa4c8a04a8f",
    "observed_at": "2026-09-29T23:24:15.779Z"
  },
  {
    "name": "function_search_path_mutable",
    "title": "Function Search Path Mutable",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects functions where the search_path parameter is not set.",
    "detail": "Function \\`public.distribucion_statements_inmutable\\` has a role mutable search_path",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable",
    "metadata": {
      "schema": "public",
      "name": "distribucion_statements_inmutable",
      "type": "function"
    },
    "cache_key": "function_search_path_mutable_public_distribucion_statements_inmutable_1b86218cf066c593ce1ea4b2de3bbcf1",
    "observed_at": "2026-09-29T23:24:15.779Z"
  },
  {
    "name": "anon_security_definer_function_executable",
    "title": "Public Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable without signing in. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if it is not meant to be public.",
    "detail": "Function `public.current_user_roles()` can be executed by the `anon` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/current_user_roles`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable",
    "metadata": {
      "schema": "public",
      "name": "current_user_roles",
      "language": "sql",
      "arguments": "",
      "security_definer": true
    },
    "cache_key": "anon_security_definer_function_executable_public_current_user_roles_",
    "observed_at": "2026-09-29T23:24:15.779Z"
  },
  {
    "name": "anon_security_definer_function_executable",
    "title": "Public Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable without signing in. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if it is not meant to be public.",
    "detail": "Function `public.es_mi_ficha_profesional(p_professional_id uuid)` can be executed by the `anon` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/es_mi_ficha_profesional`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable",
    "metadata": {
      "schema": "public",
      "name": "es_mi_ficha_profesional",
      "language": "sql",
      "arguments": "p_professional_id uuid",
      "security_definer": true
    },
    "cache_key": "anon_security_definer_function_executable_public_es_mi_ficha_profesional_p_professional_id uuid",
    "observed_at": "2026-09-29T23:24:15.779Z"
  },
  {
    "name": "anon_security_definer_function_executable",
    "title": "Public Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable without signing in. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if it is not meant to be public.",
    "detail": "Function `public.handle_new_user()` can be executed by the `anon` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/handle_new_user`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable",
    "metadata": {
      "schema": "public",
      "name": "handle_new_user",
      "language": "plpgsql",
      "arguments": "",
      "security_definer": true
    },
    "cache_key": "anon_security_definer_function_executable_public_handle_new_user_",
    "observed_at": "2026-09-29T23:24:15.779Z"
  },
  {
    "name": "anon_security_definer_function_executable",
    "title": "Public Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable without signing in. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if it is not meant to be public.",
    "detail": "Function `public.has_active_grant(p_grant_type public.access_grant_type, p_resource_id uuid)` can be executed by the `anon` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/has_active_grant`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable",
    "metadata": {
      "schema": "public",
      "name": "has_active_grant",
      "language": "sql",
      "arguments": "p_grant_type public.access_grant_type, p_resource_id uuid",
      "security_definer": true
    },
    "cache_key": "anon_security_definer_function_executable_public_has_active_grant_p_grant_type public.access_grant_type, p_resource_id uuid",
    "observed_at": "2026-09-29T23:24:15.779Z"
  },
  {
    "name": "anon_security_definer_function_executable",
    "title": "Public Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable without signing in. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if it is not meant to be public.",
    "detail": "Function `public.has_role(p_role public.app_role)` can be executed by the `anon` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/has_role`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable",
    "metadata": {
      "schema": "public",
      "name": "has_role",
      "language": "sql",
      "arguments": "p_role public.app_role",
      "security_definer": true
    },
    "cache_key": "anon_security_definer_function_executable_public_has_role_p_role public.app_role",
    "observed_at": "2026-09-29T23:24:15.779Z"
  },
  {
    "name": "anon_security_definer_function_executable",
    "title": "Public Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable without signing in. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if it is not meant to be public.",
    "detail": "Function `public.is_own_professional_profile(p_professional_id uuid)` can be executed by the `anon` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/is_own_professional_profile`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable",
    "metadata": {
      "schema": "public",
      "name": "is_own_professional_profile",
      "language": "sql",
      "arguments": "p_professional_id uuid",
      "security_definer": true
    },
    "cache_key": "anon_security_definer_function_executable_public_is_own_professional_profile_p_professional_id uuid",
    "observed_at": "2026-09-29T23:24:15.779Z"
  },
  {
    "name": "anon_security_definer_function_executable",
    "title": "Public Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable without signing in. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if it is not meant to be public.",
    "detail": "Function `public.is_patient_professional(p_patient_id uuid)` can be executed by the `anon` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/is_patient_professional`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable",
    "metadata": {
      "schema": "public",
      "name": "is_patient_professional",
      "language": "sql",
      "arguments": "p_patient_id uuid",
      "security_definer": true
    },
    "cache_key": "anon_security_definer_function_executable_public_is_patient_professional_p_patient_id uuid",
    "observed_at": "2026-09-29T23:24:15.779Z"
  },
  {
    "name": "anon_security_definer_function_executable",
    "title": "Public Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable without signing in. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if it is not meant to be public.",
    "detail": "Function `public.nutra_faltante_case_coherence()` can be executed by the `anon` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/nutra_faltante_case_coherence`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable",
    "metadata": {
      "schema": "public",
      "name": "nutra_faltante_case_coherence",
      "language": "plpgsql",
      "arguments": "",
      "security_definer": true
    },
    "cache_key": "anon_security_definer_function_executable_public_nutra_faltante_case_coherence_",
    "observed_at": "2026-09-29T23:24:15.779Z"
  },
  {
    "name": "anon_security_definer_function_executable",
    "title": "Public Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable without signing in. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if it is not meant to be public.",
    "detail": "Function `public.nutra_faltante_project()` can be executed by the `anon` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/nutra_faltante_project`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable",
    "metadata": {
      "schema": "public",
      "name": "nutra_faltante_project",
      "language": "plpgsql",
      "arguments": "",
      "security_definer": true
    },
    "cache_key": "anon_security_definer_function_executable_public_nutra_faltante_project_",
    "observed_at": "2026-09-29T23:24:15.779Z"
  },
  {
    "name": "anon_security_definer_function_executable",
    "title": "Public Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable without signing in. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if it is not meant to be public.",
    "detail": "Function `public.nutra_faltante_settle()` can be executed by the `anon` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/nutra_faltante_settle`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable",
    "metadata": {
      "schema": "public",
      "name": "nutra_faltante_settle",
      "language": "plpgsql",
      "arguments": "",
      "security_definer": true
    },
    "cache_key": "anon_security_definer_function_executable_public_nutra_faltante_settle_",
    "observed_at": "2026-09-29T23:24:15.779Z"
  },
  {
    "name": "anon_security_definer_function_executable",
    "title": "Public Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable without signing in. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if it is not meant to be public.",
    "detail": "Function `public.nutra_faltante_transition_valid()` can be executed by the `anon` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/nutra_faltante_transition_valid`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable",
    "metadata": {
      "schema": "public",
      "name": "nutra_faltante_transition_valid",
      "language": "plpgsql",
      "arguments": "",
      "security_definer": true
    },
    "cache_key": "anon_security_definer_function_executable_public_nutra_faltante_transition_valid_",
    "observed_at": "2026-09-29T23:24:15.779Z"
  },
  {
    "name": "anon_security_definer_function_executable",
    "title": "Public Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable without signing in. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if it is not meant to be public.",
    "detail": "Function `public.nutra_inventory_coherence()` can be executed by the `anon` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/nutra_inventory_coherence`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable",
    "metadata": {
      "schema": "public",
      "name": "nutra_inventory_coherence",
      "language": "plpgsql",
      "arguments": "",
      "security_definer": true
    },
    "cache_key": "anon_security_definer_function_executable_public_nutra_inventory_coherence_",
    "observed_at": "2026-09-29T23:24:15.779Z"
  },
  {
    "name": "anon_security_definer_function_executable",
    "title": "Public Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable without signing in. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if it is not meant to be public.",
    "detail": "Function `public.nutra_movement_apply()` can be executed by the `anon` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/nutra_movement_apply`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable",
    "metadata": {
      "schema": "public",
      "name": "nutra_movement_apply",
      "language": "plpgsql",
      "arguments": "",
      "security_definer": true
    },
    "cache_key": "anon_security_definer_function_executable_public_nutra_movement_apply_",
    "observed_at": "2026-09-29T23:24:15.779Z"
  },
  {
    "name": "anon_security_definer_function_executable",
    "title": "Public Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable without signing in. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if it is not meant to be public.",
    "detail": "Function `public.nutra_movement_lote_del_producto()` can be executed by the `anon` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/nutra_movement_lote_del_producto`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable",
    "metadata": {
      "schema": "public",
      "name": "nutra_movement_lote_del_producto",
      "language": "plpgsql",
      "arguments": "",
      "security_definer": true
    },
    "cache_key": "anon_security_definer_function_executable_public_nutra_movement_lote_del_producto_",
    "observed_at": "2026-09-29T23:24:15.779Z"
  },
  {
    "name": "anon_security_definer_function_executable",
    "title": "Public Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable without signing in. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if it is not meant to be public.",
    "detail": "Function `public.nutra_movement_remesa_link()` can be executed by the `anon` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/nutra_movement_remesa_link`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable",
    "metadata": {
      "schema": "public",
      "name": "nutra_movement_remesa_link",
      "language": "plpgsql",
      "arguments": "",
      "security_definer": true
    },
    "cache_key": "anon_security_definer_function_executable_public_nutra_movement_remesa_link_",
    "observed_at": "2026-09-29T23:24:15.779Z"
  },
  {
    "name": "anon_security_definer_function_executable",
    "title": "Public Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable without signing in. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if it is not meant to be public.",
    "detail": "Function `public.patient_professional_anexo3_current(p_patient_id uuid)` can be executed by the `anon` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/patient_professional_anexo3_current`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable",
    "metadata": {
      "schema": "public",
      "name": "patient_professional_anexo3_current",
      "language": "sql",
      "arguments": "p_patient_id uuid",
      "security_definer": true
    },
    "cache_key": "anon_security_definer_function_executable_public_patient_professional_anexo3_current_p_patient_id uuid",
    "observed_at": "2026-09-29T23:24:15.779Z"
  },
  {
    "name": "anon_security_definer_function_executable",
    "title": "Public Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable without signing in. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if it is not meant to be public.",
    "detail": "Function `public.reparto_residuo_cnv_valido()` can be executed by the `anon` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/reparto_residuo_cnv_valido`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable",
    "metadata": {
      "schema": "public",
      "name": "reparto_residuo_cnv_valido",
      "language": "plpgsql",
      "arguments": "",
      "security_definer": true
    },
    "cache_key": "anon_security_definer_function_executable_public_reparto_residuo_cnv_valido_",
    "observed_at": "2026-09-29T23:24:15.779Z"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.current_user_roles()` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/current_user_roles`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "schema": "public",
      "name": "current_user_roles",
      "language": "sql",
      "arguments": "",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_current_user_roles_",
    "observed_at": "2026-09-29T23:24:15.779Z"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.es_mi_ficha_profesional(p_professional_id uuid)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/es_mi_ficha_profesional`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "schema": "public",
      "name": "es_mi_ficha_profesional",
      "language": "sql",
      "arguments": "p_professional_id uuid",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_es_mi_ficha_profesional_p_professional_id uuid",
    "observed_at": "2026-09-29T23:24:15.779Z"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.handle_new_user()` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/handle_new_user`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "schema": "public",
      "name": "handle_new_user",
      "language": "plpgsql",
      "arguments": "",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_handle_new_user_",
    "observed_at": "2026-09-29T23:24:15.779Z"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.has_active_grant(p_grant_type public.access_grant_type, p_resource_id uuid)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/has_active_grant`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "schema": "public",
      "name": "has_active_grant",
      "language": "sql",
      "arguments": "p_grant_type public.access_grant_type, p_resource_id uuid",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_has_active_grant_p_grant_type public.access_grant_type, p_resource_id uuid",
    "observed_at": "2026-09-29T23:24:15.779Z"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.has_role(p_role public.app_role)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/has_role`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "schema": "public",
      "name": "has_role",
      "language": "sql",
      "arguments": "p_role public.app_role",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_has_role_p_role public.app_role",
    "observed_at": "2026-09-29T23:24:15.779Z"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.is_own_professional_profile(p_professional_id uuid)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/is_own_professional_profile`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "schema": "public",
      "name": "is_own_professional_profile",
      "language": "sql",
      "arguments": "p_professional_id uuid",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_is_own_professional_profile_p_professional_id uuid",
    "observed_at": "2026-09-29T23:24:15.779Z"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.is_patient_professional(p_patient_id uuid)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/is_patient_professional`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "schema": "public",
      "name": "is_patient_professional",
      "language": "sql",
      "arguments": "p_patient_id uuid",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_is_patient_professional_p_patient_id uuid",
    "observed_at": "2026-09-29T23:24:15.779Z"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.nutra_faltante_case_coherence()` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/nutra_faltante_case_coherence`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "schema": "public",
      "name": "nutra_faltante_case_coherence",
      "language": "plpgsql",
      "arguments": "",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_nutra_faltante_case_coherence_",
    "observed_at": "2026-09-29T23:24:15.779Z"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.nutra_faltante_project()` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/nutra_faltante_project`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "schema": "public",
      "name": "nutra_faltante_project",
      "language": "plpgsql",
      "arguments": "",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_nutra_faltante_project_",
    "observed_at": "2026-09-29T23:24:15.779Z"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.nutra_faltante_settle()` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/nutra_faltante_settle`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "schema": "public",
      "name": "nutra_faltante_settle",
      "language": "plpgsql",
      "arguments": "",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_nutra_faltante_settle_",
    "observed_at": "2026-09-29T23:24:15.779Z"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.nutra_faltante_transition_valid()` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/nutra_faltante_transition_valid`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "schema": "public",
      "name": "nutra_faltante_transition_valid",
      "language": "plpgsql",
      "arguments": "",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_nutra_faltante_transition_valid_",
    "observed_at": "2026-09-29T23:24:15.779Z"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.nutra_inventory_coherence()` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/nutra_inventory_coherence`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "schema": "public",
      "name": "nutra_inventory_coherence",
      "language": "plpgsql",
      "arguments": "",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_nutra_inventory_coherence_",
    "observed_at": "2026-09-29T23:24:15.779Z"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.nutra_movement_apply()` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/nutra_movement_apply`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "schema": "public",
      "name": "nutra_movement_apply",
      "language": "plpgsql",
      "arguments": "",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_nutra_movement_apply_",
    "observed_at": "2026-09-29T23:24:15.779Z"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.nutra_movement_lote_del_producto()` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/nutra_movement_lote_del_producto`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "schema": "public",
      "name": "nutra_movement_lote_del_producto",
      "language": "plpgsql",
      "arguments": "",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_nutra_movement_lote_del_producto_",
    "observed_at": "2026-09-29T23:24:15.779Z"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.nutra_movement_remesa_link()` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/nutra_movement_remesa_link`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "schema": "public",
      "name": "nutra_movement_remesa_link",
      "language": "plpgsql",
      "arguments": "",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_nutra_movement_remesa_link_",
    "observed_at": "2026-09-29T23:24:15.779Z"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.patient_professional_anexo3_current(p_patient_id uuid)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/patient_professional_anexo3_current`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "schema": "public",
      "name": "patient_professional_anexo3_current",
      "language": "sql",
      "arguments": "p_patient_id uuid",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_patient_professional_anexo3_current_p_patient_id uuid",
    "observed_at": "2026-09-29T23:24:15.779Z"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.reparto_residuo_cnv_valido()` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/reparto_residuo_cnv_valido`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "schema": "public",
      "name": "reparto_residuo_cnv_valido",
      "language": "plpgsql",
      "arguments": "",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_reparto_residuo_cnv_valido_",
    "observed_at": "2026-09-29T23:24:15.779Z"
  },
  {
    "name": "auth_leaked_password_protection",
    "title": "Leaked Password Protection Disabled",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Leaked password protection is currently disabled.",
    "detail": "Supabase Auth prevents the use of compromised passwords by checking against HaveIBeenPwned.org. Enable this feature to enhance security.",
    "remediation": "https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection",
    "metadata": {
      "entity": "Auth",
      "type": "auth"
    },
    "cache_key": "auth_leaked_password_protection"
  }
]"