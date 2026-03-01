# Bulb Forecast AI

## Repository Structure
- `/src` – Frontend + modeling logic  
- `/supabase` – Backend configuration  
- `/public` – Static assets  
- `/docs` – Architecture & modeling notes  

# System Architecture
NOAA Data  
→ GDD Aggregation  
→ Easter Offset  
→ Regression Model  
→ Removal Window Output

Predictive modeling system for determining optimal seasonal bulb removal timing using Growing Degree Days (GDD) and Easter date regression modeling.

## 🌱 Problem
Seasonal bulb production cycles depend heavily on:
- Temperature accumulation
- Calendar timing (Easter shifts year to year)
- Regional weather variability

Traditional scheduling relies on fixed calendar dates, which leads to:
- Early or late cooler removal
- Yield variability
- Labor inefficiency

## 🧠 Approach
This project models bulb readiness using:

- Growing Degree Day (GDD) accumulation
- Historical Easter date offsets
- Regression-based forecasting
- Historical removal data

The system forecasts removal windows dynamically based on temperature progression rather than fixed dates.

## 🏗 Architecture
Frontend:
- React + TypeScript
- Tailwind + shadcn-ui

Modeling:
- Time-series temperature aggregation
- GDD calculation logic
- Easter date variable integration
- Regression modeling

Deployment:
- Hosted via Lovable

## ⚖️ Key Tradeoffs
- Prioritized explainability over black-box ML
- Deterministic regression instead of neural modeling
- Used simplified NOAA historical temperature datasets for v1

## 🚀 Future Improvements
- Real-time NOAA API integration
- Region-specific calibration
- Probabilistic forecasting bands
- Multi-variable environmental modeling (light + humidity)

## 🔬 Why This Matters
This project demonstrates applied predictive modeling in real-world agricultural operations, translating environmental variability into actionable operational decisions.

Built and maintained by Paige Miller
