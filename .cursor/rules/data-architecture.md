# Arquitectura de Datos - ContaMacros

- **Persistencia:** Usamos `AsyncStorage` mediante el wrapper `src/core/storage/storage.ts`.
- **Mapeo:** Queda prohibido usar datos crudos de Supabase en la UI. Siempre pasar por `mapProfileDb` o mappers equivalentes en `src/domain/mappers`.
- **Repositorios:** Toda llamada a base de datos debe residir en `src/data/repositories` y retornar el tipo `RepoResult<T>`.
- **OFF API:** Al usar Open Food Facts, siempre verificar si la energía viene en kJ y convertir a kcal ($1 kcal = 4.184 kJ$).