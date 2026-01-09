#!/bin/bash
# Make a user an admin

if [ -z "$1" ]; then
    echo "Usage: ./make-admin.sh <user_id>"
    echo "Example: ./make-admin.sh alice-johnson"
    exit 1
fi

USER_ID="$1"

echo "Making user '$USER_ID' an admin..."

docker exec letushack-postgres psql -U postgres -d letushack_db -c "
UPDATE users SET role = 'admin' WHERE user_id = '$USER_ID';
"

# Verify
ROLE=$(docker exec letushack-postgres psql -U postgres -d letushack_db -t -c "
SELECT role FROM users WHERE user_id = '$USER_ID';
" | tr -d '[:space:]')

if [ "$ROLE" = "admin" ]; then
    echo "✅ Success! User '$USER_ID' is now an admin."
    echo ""
    echo "They can now access:"
    echo "  • Admin Panel: http://localhost:3000/admin/panel"
    echo "  • K8s Dashboard: http://localhost:3000/admin/k8s-dashboard"
else
    echo "❌ Failed to make user an admin. User might not exist."
    echo ""
    echo "List all users:"
    docker exec letushack-postgres psql -U postgres -d letushack_db -c "SELECT user_id, name, role FROM users;"
fi
