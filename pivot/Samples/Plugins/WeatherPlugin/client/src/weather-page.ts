import { css, type CSSResultGroup, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { map } from 'lit/directives/map.js';
import { when } from 'lit/directives/when.js';


interface WeatherForecast {
	date:         string;
	temperatureC: number;
	temperatureF: number;
	summary:      string;
}


/**
 * Weather forecast page component.
 * Fetches and displays a 5-day weather forecast from the WeatherPlugin API.
 */
@customElement('weather-page')
export class WeatherPage extends LitElement {

	@state() protected forecasts: WeatherForecast[] = [];
	@state() protected loading = true;
	@state() protected error:     string | undefined;

	override connectedCallback(): void {
		super.connectedCallback();
		this.loadForecast();
	}

	protected async loadForecast(): Promise<void> {
		try {
			this.loading = true;
			this.error = undefined;

			const response = await fetch('/api/weather/forecast');
			if (!response.ok)
				throw new Error(`HTTP ${ response.status }: ${ response.statusText }`);

			this.forecasts = await response.json();
		}
		catch (err) {
			this.error = err instanceof Error ? err.message : String(err);
		}
		finally {
			this.loading = false;
		}
	}

	protected handleRefresh(e: Event): void {
		e.preventDefault();
		this.loadForecast();
	}

	override render(): unknown {
		return html`
		<div class="weather-page">
			<header>
				<h1>🌤️ Weather Forecast</h1>
				<button @click=${ this.handleRefresh } ?disabled=${ this.loading }>
					${ when(this.loading,
						() => html`Loading...`,
						() => html`Refresh`) }
				</button>
			</header>
			${ when(this.error,
				() => html`
				<div class="error">
					<p>Failed to load forecast: ${ this.error }</p>
				</div>
				`,
				() => html`
				<div class="forecast-grid">
					${ map(this.forecasts, forecast => html`
					<div class="forecast-card">
						<div class="date">${ new Date(forecast.date).toLocaleDateString() }</div>
						<div class="temp">${ forecast.temperatureC }°C</div>
						<div class="temp-f">${ forecast.temperatureF }°F</div>
						<div class="summary">${ forecast.summary }</div>
					</div>
					`) }
				</div>
				`) }
		</div>
		`;
	}

	static override styles: CSSResultGroup = css`
		:host {
			display: block;
		}
		.weather-page {
			max-width: 900px;
		}
		header {
			display: flex;
			align-items: center;
			gap: 1rem;
			margin-bottom: 1.5rem;
		}
		header h1 {
			margin: 0;
			font-size: 1.5rem;
		}
		button {
			padding: 0.4rem 1rem;
			border: 1px solid var(--border, #45475a);
			border-radius: 6px;
			background: var(--button-bg, #313244);
			color: var(--button-fg, #cdd6f4);
			cursor: pointer;
			transition: background 0.15s;
		}
		button:hover:not(:disabled) {
			background: var(--button-hover, #45475a);
		}
		button:disabled {
			opacity: 0.5;
			cursor: not-allowed;
		}
		.forecast-grid {
			display: grid;
			grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
			gap: 1rem;
		}
		.forecast-card {
			padding: 1rem;
			border: 1px solid var(--border, #45475a);
			border-radius: 8px;
			background: var(--card-bg, #1e1e2e);
			text-align: center;
		}
		.date {
			font-size: 0.85rem;
			color: var(--date-fg, #a6adc8);
			margin-bottom: 0.5rem;
		}
		.temp {
			font-size: 1.8rem;
			font-weight: 700;
		}
		.temp-f {
			font-size: 0.85rem;
			color: var(--date-fg, #a6adc8);
		}
		.summary {
			margin-top: 0.5rem;
			font-size: 0.9rem;
		}
		.error {
			padding: 1rem;
			border: 1px solid var(--error-border, #f38ba8);
			border-radius: 8px;
			background: var(--error-bg, #302030);
			color: var(--error-fg, #f38ba8);
		}
	`;

}
