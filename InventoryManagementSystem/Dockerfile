# =====================================================================
#  Cloud Inventory Management System - API image
#
#  Multi-stage: the JDK and the Maven cache stay in the build stage, so
#  the shipped image carries a JRE and one jar and nothing else. That is
#  a smaller download and a smaller attack surface than shipping a build
#  toolchain to production.
# =====================================================================

# ---------- build ----------
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /build

# Dependencies first: this layer is cached and only re-resolves when
# pom.xml itself changes, not on every source edit.
COPY pom.xml .
RUN mvn -B dependency:go-offline

COPY src ./src
RUN mvn -B clean package -DskipTests

# ---------- runtime ----------
FROM eclipse-temurin:21-jre-jammy AS runtime

# curl is here only so the container healthcheck has something to run.
RUN apt-get update \
    && apt-get install --no-install-recommends -y curl \
    && rm -rf /var/lib/apt/lists/*

# Never run the service as root.
RUN groupadd --system inventory \
    && useradd --system --gid inventory --home-dir /app --shell /usr/sbin/nologin inventory

WORKDIR /app
COPY --from=build /build/target/*.jar app.jar
RUN chown -R inventory:inventory /app
USER inventory

EXPOSE 8080

# MaxRAMPercentage rather than a fixed -Xmx: the JVM then respects
# whatever memory limit the container is actually given.
ENV JAVA_OPTS="-XX:MaxRAMPercentage=75"

HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
    CMD curl -fsS http://localhost:8080/actuator/health || exit 1

ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar /app/app.jar"]
