#!/bin/bash

# Cleanup Script for Scheduled Loft Room Deletion
# This script should be run daily (preferably at midnight UTC)

# Set your Supabase project details
SUPABASE_URL="your-supabase-url"
SUPABASE_ANON_KEY="your-supabase-anon-key"
CLEANUP_FUNCTION_URL="${SUPABASE_URL}/functions/v1/cleanup-ended-rooms"

echo "Starting Loft room cleanup process..."

# Call the cleanup function
response=$(curl -s -X POST \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{}' \
  "${CLEANUP_FUNCTION_URL}")

echo "Cleanup response: ${response}"

# Parse response for logging
if echo "$response" | grep -q '"success":true'; then
  deleted_count=$(echo "$response" | grep -o '"deletedCount":[0-9]*' | cut -d':' -f2)
  failed_count=$(echo "$response" | grep -o '"failedCount":[0-9]*' | cut -d':' -f2)
  echo "✅ Cleanup successful: Deleted ${deleted_count} rooms, ${failed_count} failed"
else
  echo "❌ Cleanup failed: ${response}"
  exit 1
fi
