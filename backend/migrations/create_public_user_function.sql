-- Create a function to insert a user record
CREATE OR REPLACE FUNCTION create_public_user(
    user_id UUID,
    user_email VARCHAR,
    user_first_name VARCHAR,
    user_last_name VARCHAR,
    user_role VARCHAR,
    user_onboarding_complete BOOLEAN
) RETURNS json AS $$
DECLARE
    result json;
BEGIN
    INSERT INTO users (
        id,
        email,
        "firstName",
        "lastName",
        role,
        "onboardingComplete",
        "createdAt",
        "updatedAt"
    ) VALUES (
        user_id,
        user_email,
        user_first_name,
        user_last_name,
        user_role,
        user_onboarding_complete,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    )
    RETURNING json_build_object(
        'id', id,
        'email', email,
        'firstName', "firstName",
        'lastName', "lastName",
        'role', role,
        'onboardingComplete', "onboardingComplete",
        'createdAt', "createdAt",
        'updatedAt', "updatedAt"
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 