-- Enable pgvector if not already
create extension if not exists vector;

-- Support knowledge base for Support Agent
create table if not exists public.support_knowledge (
  id uuid default uuid_generate_v4() primary key,
  type text not null, -- tool, faq, blog, plan
  title text,
  content text,
  restricted boolean default false,
  embedding vector(1536)
);

create index if not exists idx_support_knowledge_type on public.support_knowledge(type);
create index if not exists idx_support_knowledge_title on public.support_knowledge using gin (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(content,'')));
create index if not exists idx_support_knowledge_embedding on public.support_knowledge using ivfflat (embedding vector_l2_ops) with (lists = 100);

-- Helper RPC to search knowledge by embedding
create or replace function public.search_support_knowledge(query_embedding vector(1536), match_limit int default 5)
returns table(id uuid, type text, title text, content text, restricted boolean, similarity float)
language sql stable parallel safe as $$
  select k.id, k.type, k.title, k.content, k.restricted,
         1 - (k.embedding <=> query_embedding) as similarity
  from public.support_knowledge k
  where k.embedding is not null
  order by k.embedding <=> query_embedding
  limit match_limit;
$$;


