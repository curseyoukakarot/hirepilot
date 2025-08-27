-- Vector match RPC for RAG
create or replace function public.match_kb_chunks(
  query_embedding vector(1536),
  match_count int default 4,
  min_similarity float default 0
)
returns table(page_id uuid, url text, title text, content text, similarity float)
language sql
stable
as $$
  select c.page_id, p.url, p.title, c.content,
         1 - (c.embedding <-> query_embedding) as similarity
  from public.rex_kb_chunks c
  join public.rex_kb_pages p on p.id = c.page_id
  where c.embedding is not null
  order by c.embedding <-> query_embedding
  limit greatest(match_count, 1)
$$;

grant execute on function public.match_kb_chunks(vector, int, float) to anon, authenticated, service_role;


