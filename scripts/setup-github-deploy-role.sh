#!/usr/bin/env bash
# One-time setup: lets GitHub Actions (MobeenAshiq/logic-lab, main branch only) sign in
# to AWS without stored keys, with permission ONLY to open/close SSH on the server's
# security group. Prints the role ARN to save as the AWS_DEPLOY_ROLE_ARN secret.
# Usage: scripts/setup-github-deploy-role.sh   (needs: aws login --profile logiclab)
set -euo pipefail

PROFILE="${AWS_PROFILE:-logiclab}"
REGION="ap-southeast-2"
REPO="MobeenAshiq/logic-lab"
SG_ID="sg-0d7e21f6db8ce8248"
ROLE="logiclab-github-deploy"
OIDC_HOST="token.actions.githubusercontent.com"
aws() { command aws --profile "$PROFILE" "$@"; }

ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
PROVIDER_ARN="arn:aws:iam::${ACCOUNT}:oidc-provider/${OIDC_HOST}"

if aws iam get-open-id-connect-provider --open-id-connect-provider-arn "$PROVIDER_ARN" >/dev/null 2>&1; then
  echo "• GitHub OIDC provider already exists"
else
  aws iam create-open-id-connect-provider --url "https://${OIDC_HOST}" \
    --client-id-list sts.amazonaws.com >/dev/null
  echo "• Created GitHub OIDC provider"
fi

TRUST=$(cat <<JSON
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Federated": "${PROVIDER_ARN}" },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": {
        "${OIDC_HOST}:aud": "sts.amazonaws.com",
        "${OIDC_HOST}:sub": "repo:${REPO}:ref:refs/heads/main"
      }
    }
  }]
}
JSON
)

PERMS=$(cat <<JSON
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "OpenCloseSshOnServerFirewallOnly",
    "Effect": "Allow",
    "Action": ["ec2:AuthorizeSecurityGroupIngress", "ec2:RevokeSecurityGroupIngress"],
    "Resource": "arn:aws:ec2:${REGION}:${ACCOUNT}:security-group/${SG_ID}"
  }]
}
JSON
)

if aws iam get-role --role-name "$ROLE" >/dev/null 2>&1; then
  aws iam update-assume-role-policy --role-name "$ROLE" --policy-document "$TRUST"
  echo "• Updated role $ROLE"
else
  aws iam create-role --role-name "$ROLE" --assume-role-policy-document "$TRUST" \
    --description "GitHub Actions deploy for ${REPO}: open/close SSH on ${SG_ID}" \
    --max-session-duration 3600 >/dev/null
  echo "• Created role $ROLE"
fi
aws iam put-role-policy --role-name "$ROLE" --policy-name ssh-ingress-only --policy-document "$PERMS"

echo
echo "Save this as the GitHub secret AWS_DEPLOY_ROLE_ARN:"
aws iam get-role --role-name "$ROLE" --query Role.Arn --output text
