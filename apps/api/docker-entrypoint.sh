#!/bin/sh
set -e

echo "Applying database schema..."
npx prisma db push --accept-data-loss

echo "Cleaning legacy fixed login accounts..."
npx prisma db seed

echo "Starting backend..."
exec "$@"
