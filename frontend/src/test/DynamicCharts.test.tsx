import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BarChartComponent } from '../components/Chat/charts/BarChartComponent';
import { LineChartComponent } from '../components/Chat/charts/LineChartComponent';
import { MultiSeriesChartComponent } from '../components/Chat/charts/MultiSeriesChartComponent';
import { ChartBlockPreview } from '../components/Chat/blocks/ChartBlockPreview';
import type {
  BarChartBlock,
  LineChartBlock,
  ChartDataPoint,
} from '../types/blocks';

describe('Flexible Dynamic Charts', () => {
  describe('BarChartComponent', () => {
    it('renders with variable category counts and formats currency', () => {
      const data: ChartDataPoint[] = [
        { label: 'Data Science', value: 14.5 },
        { label: 'Cybersecurity', value: 12.0 },
        { label: 'Cloud Architecture', value: 18.2 },
      ];

      render(
        <BarChartComponent
          data={data}
          unit="LPA"
          valueFormat="currency"
          title="Industry Package Benchmark"
        />
      );

      // Verify categories rendered in accessible table and SVG
      expect(screen.getAllByText('Data Science').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Cybersecurity').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Cloud Architecture').length).toBeGreaterThan(0);

      // Verify formatted currency values in screen reader table
      expect(screen.getByText('₹14.5 LPA')).toBeDefined();
      expect(screen.getByText('₹18.2 LPA')).toBeDefined();
    });

    it('handles missing values honestly without replacing with zero', () => {
      const data: ChartDataPoint[] = [
        { label: 'Tier 1 Institutes', value: 22.5 },
        { label: 'Unaccredited Bootcamps', value: null, status: 'unavailable' }, // missing value
        { label: 'State Universities', value: 8.5 },
      ];

      render(
        <BarChartComponent
          data={data}
          unit="LPA"
          title="Compensation Transparency"
        />
      );

      // Verify "No Data" placeholder label is rendered for missing entry
      expect(screen.getByText('No Data')).toBeDefined();
      // Verify unavailable in accessible summary table
      expect(screen.getByText('Unavailable')).toBeDefined();
    });
  });

  describe('LineChartComponent', () => {
    it('renders time-series periods and creates gaps for missing values', () => {
      const data: ChartDataPoint[] = [
        { label: '2020', value: 45 },
        { label: '2021', value: 55 },
        { label: '2022', value: null }, // Gap in time-series
        { label: '2023', value: 75 },
        { label: '2024', value: 90, is_projected: true },
      ];

      const { container } = render(
        <LineChartComponent
          data={data}
          xLabel="Calendar Year"
          yLabel="Index Score"
          title="Talent Demand Growth"
        />
      );

      expect(screen.getAllByText('2020').length).toBeGreaterThan(0);
      expect(screen.getAllByText('2024').length).toBeGreaterThan(0);
      expect(screen.getByText('Calendar Year')).toBeDefined();
      expect(screen.getByText('Index Score')).toBeDefined();

      // Because 2022 is null, multiple path segments should be generated (gap in curve)
      const paths = container.querySelectorAll('svg path');
      expect(paths.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('MultiSeriesChartComponent', () => {
    it('renders multi-series grouped bars and allows legend toggling', () => {
      const series = [
        {
          name: 'Traditional Engineering',
          points: [
            { label: 'Year 1', value: 6.0 },
            { label: 'Year 3', value: 12.0 },
          ],
        },
        {
          name: 'AI Specialization',
          points: [
            { label: 'Year 1', value: 9.5 },
            { label: 'Year 3', value: 19.0 },
          ],
        },
      ];

      render(
        <MultiSeriesChartComponent
          series={series}
          chartVariant="bar"
          unit="LPA"
          valueFormat="currency"
          title="Career Trajectory Comparison"
        />
      );

      // Verify legend buttons
      const engineeringBtn = screen.getByRole('button', { name: /Traditional Engineering/i });
      const aiBtn = screen.getByRole('button', { name: /AI Specialization/i });
      expect(engineeringBtn).toBeDefined();
      expect(aiBtn).toBeDefined();

      // Click legend to filter/highlight series
      fireEvent.click(aiBtn);
      // AI button remains active while engineering is dimmed
      expect(aiBtn.className).toContain('font-semibold');
    });

    it('renders multi-series in line mode cleanly', () => {
      const series = [
        {
          name: 'Backend Dev',
          points: [
            { label: 'Q1', value: 70 },
            { label: 'Q2', value: 85 },
          ],
        },
        {
          name: 'Mobile Dev',
          points: [
            { label: 'Q1', value: 50 },
            { label: 'Q2', value: 65 },
          ],
        },
      ];

      render(
        <MultiSeriesChartComponent
          series={series}
          chartVariant="line"
          title="Hiring Pace"
        />
      );

      expect(screen.getByText('Backend Dev')).toBeDefined();
      expect(screen.getByText('Mobile Dev')).toBeDefined();
      expect(screen.getAllByText('Q1').length).toBeGreaterThan(0);
    });
  });

  describe('ChartBlockPreview Safety & Fallbacks', () => {
    it('handles empty or malformed datasets safely without crashing', () => {
      const emptyBlock: BarChartBlock = {
        type: 'chart_bar',
        title: 'Empty Compensation Dataset',
        data: [],
      };

      render(<ChartBlockPreview block={emptyBlock} />);

      expect(screen.getByText(/Empty Compensation Dataset \(Chart Unavailable\)/i)).toBeDefined();
      expect(screen.getByText(/Dataset contains no points/i)).toBeDefined();
    });

    it('displays projection disclaimer banner and allows toggling data table drawer', () => {
      const projectedBlock: LineChartBlock = {
        type: 'chart_line',
        title: 'Future Tech Projections',
        data_period: '2024 - 2028',
        disclaimer: 'Projections are mathematical estimates and not guaranteed salaries.',
        data: [
          { label: '2024', value: 50 },
          { label: '2025', value: 65, is_projected: true },
        ],
      };

      render(<ChartBlockPreview block={projectedBlock} />);

      // Verify disclaimer banner is visible
      expect(
        screen.getByText(/Projections are mathematical estimates and not guaranteed salaries./i)
      ).toBeDefined();

      // Toggle Data Table Drawer
      const toggleBtn = screen.getByRole('button', { name: /View Data Table/i });
      fireEvent.click(toggleBtn);

      // Verify table appears
      expect(screen.getByText('Hide Data Table')).toBeDefined();
      expect(screen.getAllByText('2024').length).toBeGreaterThan(0);
      expect(screen.getAllByText('2025').length).toBeGreaterThan(0);
    });

    it('ensures responsive SVG layout with mobile-friendly viewBox and no fixed-width clipping', () => {
      const block: BarChartBlock = {
        type: 'chart_bar',
        title: 'Responsive Mobile Test',
        data: [
          { label: 'Category A', value: 10 },
          { label: 'Category B', value: 20 },
        ],
      };

      const { container } = render(<ChartBlockPreview block={block} />);
      const svg = container.querySelector('svg[viewBox="0 0 560 240"]');
      expect(svg).toBeDefined();
      expect(svg?.getAttribute('class')).toContain('w-full');
    });
  });
});
