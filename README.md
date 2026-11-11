# problemas-ms

Microservicio de Gestión de Problemas (ITSM). Grupo 6, CS2032 Cloud Computing.

- Serverless Framework v3, Node.js 20, API Gateway + Lambda + DynamoDB
- Multi-tenancy: el tenant_id sale del ID token de Cognito
- Eventos SNS: problema-creado y problema-resuelto

## Endpoints
POST /problemas, GET /problemas, GET /problemas/{id},
PUT /problemas/{id}, POST /problemas/{id}/incidentes

## Despliegue
serverless deploy --stage dev

## Datos de prueba
py scripts/seed.py (10,000 problemas por tenant)
