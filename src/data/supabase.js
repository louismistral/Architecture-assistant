/* ============================================================================
   L'ADRESSE DE LA BASE — source unique.

   La clé est PUBLIABLE, et c'est voulu : elle n'ouvre rien par elle-même. Ce
   qu'on a le droit de lire est décidé dans la base, par les règles de lecture
   (row level security), et jamais par le navigateur. Le dépôt est public ;
   cette clé peut l'être aussi.

   Ce qui ne doit JAMAIS figurer ici : la clé `service_role`, qui passe outre
   toutes les règles.
   ========================================================================= */
export var SUPA = {
  url: "https://hkpzhvhydtyvbjvaikdg.supabase.co",
  key: "sb_publishable_8CY--JwktU9GmBfqSOjrMQ_0g5jpl6K",
  /* Le nom donné à l'équipe qu'on crée pour qui arrive sans invitation. */
  equipeDefaut: "Concours Saxon"
};
