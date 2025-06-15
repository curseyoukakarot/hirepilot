#!/bin/bash

# Check if stripe CLI is installed
if ! command -v stripe &> /dev/null
then
    echo "Stripe CLI is not installed. Please install it first:"
    echo "https://stripe.com/docs/stripe-cli#install"
    exit 1
fi

# Check if .env file exists and source it
if [ -f .env ]; then
    source .env
else
    echo ".env file not found"
    exit 1
fi

# Start webhook listener
echo "Starting Stripe webhook listener..."
stripe listen --forward-to localhost:3000/api/stripe/webhook 