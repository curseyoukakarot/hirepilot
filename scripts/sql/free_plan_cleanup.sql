-- Audit: users table
SELECT id, email, role, plan
FROM public.users
WHERE id IN ('c58b5154-5499-4d79-94ac-fca6f519c0c2', 'f22adeca-9a06-45a1-a7a8-1f4ccbec19bb');

-- Audit: user_credits
SELECT user_id, total_credits, used_credits, remaining_credits
FROM public.user_credits
WHERE user_id IN ('c58b5154-5499-4d79-94ac-fca6f519c0c2', 'f22adeca-9a06-45a1-a7a8-1f4ccbec19bb');

-- Audit: subscriptions (adjust schema if different)
SELECT id, user_id, status, plan_tier, stripe_subscription_id
FROM public.subscriptions
WHERE user_id IN ('c58b5154-5499-4d79-94ac-fca6f519c0c2', 'f22adeca-9a06-45a1-a7a8-1f4ccbec19bb');

-- Cleanup: force free plan and role
INSERT INTO public.users (id, plan, role)
VALUES 
    ('c58b5154-5499-4d79-94ac-fca6f519c0c2', 'free', 'free'),
    ('f22adeca-9a06-45a1-a7a8-1f4ccbec19bb', 'free', 'free')
ON CONFLICT (id) DO UPDATE SET plan = 'free', role = 'free';

-- Credits: seed or reset to 50
INSERT INTO public.user_credits (user_id, total_credits, used_credits, remaining_credits, last_updated)
VALUES 
    ('c58b5154-5499-4d79-94ac-fca6f519c0c2', 50, 0, 50, now()),
    ('f22adeca-9a06-45a1-a7a8-1f4ccbec19bb', 50, 0, 50, now())
ON CONFLICT (user_id) DO UPDATE SET total_credits=excluded.total_credits, used_credits=excluded.used_credits, remaining_credits=excluded.remaining_credits, last_updated=excluded.last_updated;

-- Delete any lingering subscriptions
DELETE FROM public.subscriptions
WHERE user_id IN ('c58b5154-5499-4d79-94ac-fca6f519c0c2', 'f22adeca-9a06-45a1-a7a8-1f4ccbec19bb');


