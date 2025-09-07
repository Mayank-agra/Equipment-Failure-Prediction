import { useState } from 'react';
import './HistoricalDataDashboard.css';

export default function HistoricalDataDashboard() {
  const [selectedCategory, setSelectedCategory] = useState('all');

  const analysisData = [
    {
      id: 'trends',
      title: 'Recall Trends',
      category: 'trends',
      charts: [
        {
          title: 'Monthly Recall Trends',
          image: '/images/Processed/recalls_trend_monthly_improved.png',
          description: 'Analysis of recall patterns over months'
        },
        {
          title: 'Yearly Recall Trends',
          image: '/images/Processed/recalls_trend_yearly.png',
          description: 'Year-over-year recall analysis'
        }
      ]
    },
    {
      id: 'causes',
      title: 'Root Causes',
      category: 'causes',
      charts: [
        {
          title: 'Root Cause Distribution',
          image: '/images/Processed/root_cause_pie_processed.png',
          description: 'Breakdown of primary causes for device recalls'
        }
      ]
    },
    {
      id: 'geography',
      title: 'Geographic Analysis',
      category: 'geography',
      charts: [
        {
          title: 'Top Countries by Recalls',
          image: '/images/Processed/top_countries.png',
          description: 'Countries with highest recall incidents'
        }
      ]
    },
    {
      id: 'devices',
      title: 'Device Analysis',
      category: 'devices',
      charts: [
        {
          title: 'Device Categories',
          image: '/images/Processed/top_device_categories.png',
          description: 'Most affected device categories'
        },
        {
          title: 'Top Manufacturers',
          image: '/images/Processed/top_manufacturers.png',
          description: 'Manufacturers with highest recall rates'
        }
      ]
    },
    {
      id: 'keywords',
      title: 'Keyword Analysis',
      category: 'keywords',
      charts: [
        {
          title: 'Top Keywords',
          image: '/images/Processed/top_keywords.png',
          description: 'Most frequently mentioned keywords in recalls'
        }
      ]
    }
  ];

  const categories = [
    { id: 'all', name: 'All Analysis', icon: '📊' },
    { id: 'trends', name: 'Trends', icon: '📈' },
    { id: 'causes', name: 'Root Causes', icon: '🔍' },
    { id: 'geography', name: 'Geography', icon: '🌍' },
    { id: 'devices', name: 'Devices', icon: '🏥' },
    { id: 'keywords', name: 'Keywords', icon: '🔤' }
  ];

  const filteredData = selectedCategory === 'all' 
    ? analysisData 
    : analysisData.filter(item => item.category === selectedCategory);

  return (
    <div className="historical-dashboard">
      <div className="dashboard-header">
        <h1 className="dashboard-title">Historical Data Analysis</h1>
        <p className="dashboard-subtitle">
          Comprehensive analysis of medical device recall patterns and trends
        </p>
      </div>

      <div className="dashboard-filters">
        <div className="filter-tabs">
          {categories.map(category => (
            <button
              key={category.id}
              className={`filter-tab ${selectedCategory === category.id ? 'active' : ''}`}
              onClick={() => setSelectedCategory(category.id)}
            >
              <span className="filter-icon">{category.icon}</span>
              <span className="filter-text">{category.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="dashboard-content">
        {filteredData.map(section => (
          <div key={section.id} className="analysis-section">
            <h2 className="section-title">{section.title}</h2>
            <div className="charts-grid">
              {section.charts.map((chart, index) => (
                <div key={index} className="chart-card">
                  <div className="chart-header">
                    <h3 className="chart-title">{chart.title}</h3>
                    <p className="chart-description">{chart.description}</p>
                  </div>
                  <div className="chart-container">
                    <img 
                      src={chart.image} 
                      alt={chart.title}
                      className="chart-image"
                      loading="lazy"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {filteredData.length === 0 && (
        <div className="no-data">
          <div className="no-data-icon">📊</div>
          <h3>No Analysis Found</h3>
          <p>No analysis data available for the selected category.</p>
        </div>
      )}
    </div>
  );
}




