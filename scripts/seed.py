"""Carga 10,000 problemas por tenant (30,000 en total).
Uso:  pip install boto3 faker
      python scripts/seed.py
Requiere credenciales del Learner Lab en ~/.aws/credentials y la tabla ya desplegada."""
import random
from datetime import datetime, timedelta, timezone
import boto3
from faker import Faker

TABLE = "itsm-problemas-dev"
TENANTS = ["empresa-alfa", "empresa-beta", "empresa-gamma"]
POR_TENANT = 10000
MAX_INC = 10000  # los INC# deben existir en Incidentes (coordinar con tu companero)
ESTADOS = ["identificado", "en_analisis", "error_conocido", "resuelto", "cerrado"]
PRIORIDADES = ["bajo", "medio", "alto", "critico"]
CAUSAS = ["Firmware con fuga de memoria", "Disco saturado", "Configuracion DNS erronea",
          "Certificado vencido", "Parche defectuoso", "Saturacion de base de datos"]
WORKAROUNDS = ["Reinicio programado cada 24 h", "Limpieza manual de logs",
               "Failover al nodo secundario", "Aumentar timeout temporalmente"]

fake = Faker("es_ES")
table = boto3.resource("dynamodb", region_name="us-east-1").Table(TABLE)
ahora = datetime.now(timezone.utc)

for tenant in TENANTS:
    with table.batch_writer() as batch:  # agrupa de 25 en 25 (batch_write_item)
        for n in range(1, POR_TENANT + 1):
            pid = f"PRB#{n:06d}"
            estado = random.choice(ESTADOS)
            creado = (ahora - timedelta(days=random.randint(0, 365),
                                        minutes=random.randint(0, 1440))).isoformat()
            analizado = estado != "identificado"
            batch.put_item(Item={
                "tenant_id": tenant, "sk": pid, "problema_id": pid,
                "titulo": f"Problema recurrente: {fake.catch_phrase()}",
                "descripcion": fake.sentence(nb_words=14),
                "estado": estado, "estado_fecha": f"{estado}#{creado}",
                "prioridad": random.choice(PRIORIDADES),
                "causa_raiz": random.choice(CAUSAS) if analizado else "",
                "workaround": random.choice(WORKAROUNDS) if analizado else "",
                "incidentes_relacionados": [f"INC#{random.randint(1, MAX_INC):06d}"
                                            for _ in range(random.randint(1, 4))],
                "cambio_id": f"CHG#{random.randint(1, 10000):06d}" if estado in ("resuelto", "cerrado") else None,
                "responsable": f"u-{fake.hexify('^^^^')}",
                "creado_en": creado, "actualizado_en": creado,
            })
            if n % 1000 == 0:
                print(f"{tenant}: {n}/{POR_TENANT}")
    # contador en 10000 para que los nuevos continuen la numeracion
    table.put_item(Item={"tenant_id": tenant, "sk": "CONTADOR#PRB", "valor": POR_TENANT})
print("Listo: 30,000 problemas cargados.")
