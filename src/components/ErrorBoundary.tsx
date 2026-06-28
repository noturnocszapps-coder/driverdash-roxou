import React, { ErrorInfo, ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import { Logger } from '../services/logger';

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
  className?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

const logger = new Logger('ErrorBoundary');

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('Caught error in child component:', error, { errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div 
          className={`p-6 rounded-2xl bg-[#1a0c25]/30 border border-rose-950/40 flex flex-col items-center text-center justify-center space-y-3 ${this.props.className || ''}`}
          id="error-boundary-container"
        >
          <div className="p-3 bg-rose-950/40 rounded-full border border-rose-900/30 text-rose-400">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h5 className="text-sm font-bold text-slate-100 font-display">Ops! Algo deu errado</h5>
            <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
              {this.props.fallbackMessage || 'Não foi possível carregar esta inteligência agora.'}
            </p>
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-1.5 bg-purple-950 hover:bg-purple-900 text-purple-300 rounded-lg text-xs font-semibold border border-purple-800/30 transition-all cursor-pointer"
          >
            Tentar Novamente
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
export default ErrorBoundary;
