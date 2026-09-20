# CrimeSphere AI on AWS

Backend for the CrimeSphere AI frontend (Bharat Builds Tour hackathon, **Ship It** track).

```
Expo web app ──HTTPS──▶ API Gateway (HTTP API, Cognito JWT authorizer)
   (Amplify)                     │
                                 ▼
                       Lambda: FastAPI (/api/v1/...)
                        │        │        │          │
                 DynamoDB     S3      Cognito    Bedrock (via Strands agent)
                 cases,      evidence  officer     copilot with read-only tools
                 alerts,     (direct   login       over the case data
                 officers    upload)
```

| Frontend feature | Endpoint | AWS service |
|---|---|---|
| Badge + PIN login | `POST /auth/login` | Cognito |
| Case list / detail / search | `GET /cases`, `/cases/{id}`, `/cases/search?q=` | DynamoDB |
| Register FIR | `POST /cases` (id + FIR number + officer set **server-side**) | DynamoDB |
| Update / delete case | `PATCH`, `DELETE /cases/{id}` | DynamoDB |
| Timeline note | `POST /cases/{id}/timeline` | DynamoDB |
| Evidence upload | `POST /cases/{id}/evidence` → presigned S3 POST (25 MB cap enforced by S3) | S3 |
| Alerts | `GET /alerts`, `PATCH /alerts/{id}/read`, `POST /alerts/mark-all-read` | DynamoDB |
| Dashboard cards | `GET /stats` | DynamoDB |
| AI Copilot | `POST /copilot/query` | Bedrock + Strands Agents |

Role permissions from `src/utils/rbac.ts` are enforced on the server (`backend/src/app/rbac.py`), so hiding a button in the UI is never the only protection.

## Prerequisites

- An AWS account (new accounts get free-tier credits; card verification costs about ₹2)
- [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) configured with `aws configure`
- [SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html)
- Python 3.10 or newer (tested on 3.12). The build script downloads Linux wheels for Lambda's Python 3.12, so Windows and Mac are fine, and Docker is not needed

## 1. Enable a Bedrock model (for the AI copilot)

1. AWS Console → **Amazon Bedrock** → **Model catalog**. Pick a text model and make sure your account has access to it (some models ask you to accept terms or fill a short use-case form the first time).
2. Copy its **model ID** (or **inference profile ID**, if the model requires one), and note the **region** you enabled it in.

You can skip this and deploy first. The copilot then answers from real case data instead of an AI model (responses carry `"source": "fallback"`), but judges will want to see the real thing.

## 2. Deploy

```bash
cd backend
python build_lambda.py

sam deploy --stack-name crimesphere --region ap-south-1 --resolve-s3 \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides BedrockModelId=<MODEL_OR_PROFILE_ID> BedrockRegion=<BEDROCK_REGION>
```

`BedrockRegion` can differ from `--region`, because models are not available everywhere. Leave both Bedrock parameters out to deploy without the model.

## 3. Load the demo data and create officer accounts

```bash
pip install boto3
python seed/seed.py --stack-name crimesphere --region ap-south-1
# choose a different PIN:  --pin 482913
```

This loads the prototype's cases and alerts into DynamoDB and creates five Cognito users, one per role. It is safe to re-run.

| Role | Badge |
|---|---|
| Commissioner | `KSP-COMM-001` |
| Inspector | `KSP-WF-4421` |
| Sub-Inspector | `KSP-SI-1024` |
| Head Constable | `KSP-HC-3012` |
| Constable | `KSP-CONST-5088` |

Default PIN is `1234`, matching the login screen. It's synthetic demo data, but the login endpoint is public, so **change the PIN or delete the stack once judging is over.**

## 4. Smoke test the deployed API

```bash
API=$(aws cloudformation describe-stacks --stack-name crimesphere --region ap-south-1 \
  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" --output text)

curl $API/health
curl -X POST $API/auth/login -H "Content-Type: application/json" \
  -d '{"badgeNumber":"KSP-WF-4421","pin":"1234"}'          # returns a token + officer

TOKEN=<paste the token>
curl $API/cases  -H "Authorization: Bearer $TOKEN"
curl -X POST $API/copilot/query -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"query":"Any chain snatching near Hoodi?"}'
```

Check that the copilot reply says `"source": "bedrock"`. If it says `"fallback"`, the model call failed. Open the Lambda's CloudWatch logs (log group `/aws/lambda/crimesphere-ApiFunction-...`) for the reason. The usual causes are model access not enabled, or a wrong model ID or region.

(On Windows PowerShell, quoting of the JSON differs. Use the Bruno/Postman app or `curl.exe` with a JSON file.)

## 5. Connect the frontend

1. Copy `frontend-patch/src/` over your project's `src/` (5 new files, 10 modified; `changes.diff` shows exactly what changed).
2. Copy `frontend-patch/.env.example` to `.env` in the project root and set `EXPO_PUBLIC_API_URL` to the `ApiUrl` value.
3. `npx expo start --web`, then log in as any badge above.

With no `EXPO_PUBLIC_API_URL`, the app runs on mock data exactly as before, which is a handy fallback for demos.

### Host it (a live URL is part of Ship It)

```bash
npm run build          # produces dist/ (and copies to build/ and web-build/)
```

AWS Console → **Amplify** → *Deploy an app without Git* → drag in the built folder (zip its contents). Then lock CORS to your Amplify domain by redeploying:

```bash
sam deploy ... --parameter-overrides BedrockModelId=... BedrockRegion=... AllowedOrigins=https://<your-app>.amplifyapp.com
```

## Run and test locally (no AWS account needed)

```bash
cd backend
pip install -r requirements-dev.txt
pytest tests            # 22 tests against local fakes of DynamoDB, S3 and Cognito
```

To run the API against a local fake AWS (this works for the Build It track too):

```bash
pip install "moto[server]" uvicorn
export AWS_ACCESS_KEY_ID=x AWS_SECRET_ACCESS_KEY=x AWS_DEFAULT_REGION=ap-south-1 AWS_ENDPOINT_URL=http://127.0.0.1:5000
moto_server -p 5000 &                       # fake AWS
# create the 3 tables (crimesphere-cases/-alerts: key "id", crimesphere-officers: key "badgeNumber")
# and the bucket "crimesphere-evidence" (see tests/conftest.py for the boto3 calls), then:
python seed/seed.py --region ap-south-1 --skip-users \
  --cases-table crimesphere-cases --alerts-table crimesphere-alerts --officers-table crimesphere-officers
cd src && DEV_AUTH=1 uvicorn app.main:app --port 8000
```

`DEV_AUTH=1` lets you log in with PIN `1234` and no Cognito. It is hard-disabled inside Lambda and never set by the template.

## Tear down (avoids surprise charges)

```bash
aws s3 rm s3://<EvidenceBucket output> --recursive     # CloudFormation can't delete a non-empty bucket
sam delete --stack-name crimesphere --region ap-south-1
```

## Design decisions worth mentioning in your write-up

- **FastAPI on Lambda (Mangum):** keeps the `/api/v1` contract your axios client was already written for, and the same code runs locally and on AWS.
- **JWT checked at API Gateway, not in code:** signature, expiry, issuer and audience are validated before Lambda runs. Only `login` and `health` are public.
- **Server-side authority:** the FIR id, FIR number and filing officer come from the server and the token, never from the request body.
- **Evidence goes straight to S3:** the API hands out a presigned POST, so large videos never pass through Lambda, and S3 itself enforces size and content type.
- **Copilot is read-only by design:** the agent's tools can only read cases and alerts. The system prompt treats case text as untrusted data, which limits what a malicious FIR description could do.
- **Graceful degradation:** if Bedrock is unavailable the copilot returns data-backed answers rather than an error.
- **Cost guards:** on-demand DynamoDB, and API throttling (20 req/s, burst 40) so a runaway client can't run up Bedrock charges.

## Known limitations (be upfront about these in the demo)

- **Not connected yet:** the Alerts screen (still local sample data), the commissioner screens (officers, stations, analytics), and the evidence-upload button. The evidence API and `casesApi.addEvidence` / `uploadToS3` helpers are ready. The button needs a file picker such as `expo-document-picker`.
- Case list and search use DynamoDB `Scan`, which is fine for hundreds of records. At scale you'd add indexes or use OpenSearch.
- The 4-digit PIN is a weak credential. A real deployment needs MFA and account lockout tuning.
- The login token lasts about an hour, after which the app signs the user out (refresh tokens are returned but not used yet).
- The Bedrock IAM permission uses `Resource: '*'`, because cross-region inference profiles span multiple ARNs. Access is still limited by which models you enable.
- Data is synthetic. Don't load real FIR data into a hackathon account.
