// Version interna del motor clinico. El prefijo "stub-" es deliberado: marca que esta
// version NO implementa la matematica real (esta congelada hasta Gildardo) y que sus
// salidas son dummy deterministas para cablear y probar la propagacion. Cuando se
// porte el motor real (B11) con golden tests (regla 6), esta version cambia a una sin
// el prefijo stub. Todo registro clinico persiste este valor en engine_version
// (constelacion de versiones, regla 7), asi que ningun dato se confunde con el real.
export const ENGINE_VERSION = "stub-0.1.0";
