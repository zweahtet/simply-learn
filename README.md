# SimplyLearn

A modern full-stack learning platform that enables users to upload, process, and interact with educational content through AI-powered features.

## 🚀 Features

- **Document Processing**: Upload and process PDF documents with AI-powered content extraction
- **Video Management**: Handle video content for educational purposes
- **Vector Search**: Advanced semantic search capabilities using Qdrant vector database
- **AI Integration**: Powered by multiple AI providers (Groq, Google GenAI, Hugging Face)
- **Real-time Processing**: Asynchronous task processing with Celery and Redis
- **Modern UI**: Responsive Next.js frontend with TypeScript
- **Authentication**: Secure user authentication via Supabase
- **Monitoring**: Built-in health checks and Flower monitoring for Celery tasks

## 🏗️ Architecture

This project follows a microservices architecture with:

- **Frontend**: Next.js 14+ with TypeScript, Tailwind CSS
- **Backend**: FastAPI with Python 3.8+
- **Database**: Supabase (PostgreSQL)
- **Vector Database**: Qdrant for semantic search
- **Cache/Message Broker**: Redis
- **Task Queue**: Celery with Flower monitoring
- **Containerization**: Docker with Docker Compose

## 📋 Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for local frontend development)
- Python 3.8+ (for local backend development)
- Git

## 🚀 Quick Start

### Using Docker (Recommended)

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd simply-learn
   ```

2. **Set up environment variables**
   ```bash
   # Copy and configure the environment file for the backend
   cp fastapi-server/.env.example fastapi-server/.env
   # Edit the .env file with your configuration
   ```

3. **Start all services**
   ```bash
   docker-compose up -d
   ```

4. **Access the applications**
   - Backend API: http://localhost:8000
   - API Documentation: http://localhost:8000/api/v1/docs
   - Flower (Celery monitoring): http://localhost:5555
   - Frontend: Start separately (see Frontend Development section)

### Local Development

#### Backend Setup

1. **Navigate to the backend directory**
   ```bash
   cd fastapi-server
   ```

2. **Create and activate virtual environment**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Configure your .env file
   ```

5. **Start the development server**
   ```bash
   python main.py
   ```

#### Frontend Setup

1. **Navigate to the client directory**
   ```bash
   cd client
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   pnpm install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   # or
   pnpm dev
   ```

4. **Access the application**
   - Frontend: http://localhost:3000

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the `fastapi-server` directory with the following variables:

```env
# Database
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_anon_key

# AI Services
GROQ_API_KEY=your_groq_api_key
GOOGLE_API_KEY=your_google_genai_key
HUGGINGFACE_API_KEY=your_huggingface_key

# Redis
REDIS_URL=redis://localhost:6379

# Qdrant
QDRANT_URL=your_qdrant_url
QDRANT_API_KEY=your_qdrant_api_key

# Application
SECRET_KEY=your_secret_key
API_V1_STR=/api/v1
```

## 📚 API Documentation

Once the backend is running, you can access:

- **Interactive API Docs**: http://localhost:8000/api/v1/docs
- **ReDoc Documentation**: http://localhost:8000/api/v1/redoc

### Main Endpoints

- `POST /api/v1/files/upload` - Upload and process documents
- `GET /api/v1/files/` - List processed files
- `POST /api/v1/videos/upload` - Upload video content
- `GET /api/v1/health` - Health check endpoint
- `POST /token` - Authentication endpoint

## 🛠️ Development

### Backend Development

The backend uses:
- **FastAPI** for the web framework
- **SQLAlchemy** for database ORM
- **Pydantic** for data validation
- **Celery** for background tasks
- **Qdrant** for vector storage and similarity search

### Frontend Development

The frontend uses:
- **Next.js 14+** with App Router
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **shadcn/ui** for UI components

### Running Tests

```bash
# Backend tests
cd fastapi-server
python -m pytest tests/

# Frontend tests
cd client
npm test
```

## 📦 Docker Services

The application consists of several Docker services:

- **web**: FastAPI application server
- **redis**: Redis cache and message broker
- **celery_worker**: Background task processor
- **celery_beat**: Scheduled task scheduler
- **flower**: Celery monitoring dashboard

## 🔍 Monitoring

- **Health Checks**: Built-in health endpoints for all services
- **Flower Dashboard**: Monitor Celery tasks at http://localhost:5555
- **Logs**: Centralized logging with configurable levels

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

If you encounter any issues or have questions:

1. Check the [API documentation](http://localhost:8000/api/v1/docs)
2. Review the logs in the `fastapi-server/logs/` directory
3. Open an issue in the repository

## 🔮 Roadmap

- [ ] Enhanced AI model integration
- [ ] Real-time collaboration features
- [ ] Mobile application
- [ ] Advanced analytics dashboard
- [ ] Multi-language support 