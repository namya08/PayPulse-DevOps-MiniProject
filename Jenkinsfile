// Jenkins pipeline for the Payment API mini project.
//
// Agent requirements (documented in README):
//   - Linux-based agent (or Jenkins controller) with:
//       * Node.js 20+  (npm ci / npm test / vite build)
//       * Docker CLI with access to a running Docker daemon
//       * Docker Compose v2 (`docker compose ...`)
//   - No secrets are hardcoded. If you later push images to a registry,
//     add a Jenkins credential (e.g. REGISTRY_CREDS) and inject it here.

pipeline {
  agent any

  options {
    timestamps()
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '10'))
  }

  // Available under "Build with Parameters". The Deploy stage always offers
  // an interactive gate regardless; this flag also allows deploy off main.
  parameters {
    booleanParam(name: 'DEPLOY_ON_ANY_BRANCH', defaultValue: false, description: 'Allow the Deploy stage on any branch, not just main/master')
  }

  environment {
    BACKEND_DIR  = 'backend'
    FRONTEND_DIR = 'frontend'
    IMAGE_API    = "payment-api:${env.BUILD_NUMBER}"
    IMAGE_WEB    = "payment-frontend:${env.BUILD_NUMBER}"
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
        echo "Build ${env.BUILD_NUMBER} on ${env.BRANCH_NAME ?: 'workspace checkout'}"
      }
    }

    stage('Install Dependencies') {
      steps {
        sh 'npm ci --prefix ${BACKEND_DIR} --no-audit --no-fund'
        sh 'npm ci --prefix ${FRONTEND_DIR} --no-audit --no-fund'
      }
    }

    stage('Automated Tests') {
      steps {
        sh 'npm test --prefix ${BACKEND_DIR}'
      }
    }

    stage('Frontend Build') {
      steps {
        sh 'npm run build --prefix ${FRONTEND_DIR}'
      }
    }

    stage('Docker Image Build') {
      steps {
        sh 'docker build -t ${IMAGE_API} ${BACKEND_DIR}'
        sh 'docker build -t ${IMAGE_WEB} ${FRONTEND_DIR}'
        sh 'docker images | grep payment- || true'
      }
    }

    stage('Deploy') {
      when {
        anyOf {
          branch 'main'
          branch 'master'
          expression { params.DEPLOY_ON_ANY_BRANCH }
        }
      }
      steps {
        script {
          def proceed = input(
            id: 'deploy',
            message: 'Deploy the Compose stack (app + Prometheus + Grafana)?',
            ok: 'Deploy',
            parameters: [
              choice(name: 'TARGET', choices: ['docker-compose', 'skip'], description: 'Deployment target')
            ]
          )
          if (proceed == 'skip') {
            echo 'Deployment skipped by user.'
          } else {
            // Compose stack is the primary local deployment path.
            // Images are rebuilt inside Compose so the deployed tag stays payment-api:1.0
            // consistently with the Kubernetes manifests.
            sh 'docker compose up -d --build'
            sh 'sleep 10'
            sh 'curl -fsS http://localhost:3000/healthz || (docker compose logs backend --tail 50 && exit 1)'
            sh 'curl -fsS http://localhost:8080/ > /dev/null'
            echo 'Deployed: dashboard http://localhost:8080, Grafana http://localhost:3001'
          }
        }
      }
    }
  }

  post {
    always {
      echo 'Pipeline finished.'
    }
    success {
      echo 'Build and tests succeeded.'
    }
    failure {
      echo 'Build failed - check stage logs above.'
    }
  }
}

// Branch parameters (create once via "Build with Parameters" or Multibranch Pipeline):
//   DEPLOY_ON_ANY_BRANCH (boolean, default false) - allow deploy stage off main.
