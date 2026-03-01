# Bulb Forecast AI

Predictive modeling system for determining optimal seasonal bulb removal timing using Growing Degree Days (GDD) and Easter date regression modeling.

---

## Repository Structure

- `/src` – Frontend and modeling logic  
- `/supabase` – Backend configuration  
- `/public` – Static assets  
- `/docs` – Architecture and modeling notes  

---

## System Architecture

### Data Flow

1. NOAA historical temperature ingestion  
2. Growing Degree Day (GDD) accumulation  
3. Easter date feature engineering  
4. Regression-based forecast modeling  
5. Removal window prediction output  

The system forecasts removal windows dynamically based on temperature progression rather than fixed calendar dates.

---

## Problem

Seasonal bulb production cycles are temperature-dependent and calendar-sensitive.

Key variables:
- Cumulative thermal accumulation  
- Movable holiday timing (Easter)  
- Regional weather variance  

Traditional fixed-date scheduling introduces:
- Early or late cooler removal  
- Yield inconsistency  
- Labor inefficiency  

---

## Approach

This system models bulb readiness using:

- Growing Degree Day (GDD) accumulation  
- Historical Easter date offsets  
- Regression-based forecasting  
- Historical removal data  

The model converts environmental variability into operationally actionable removal windows.

---

## Model Characteristics

- Deterministic regression model  
- Temperature-based time series aggregation  
- Feature engineering incorporating movable holiday offsets  
- Interpretable output for operational planning  

---

## Architecture Details

**Frontend**
- React + TypeScript  
- Tailwind CSS + shadcn-ui  

**Modeling**
- Time-series temperature aggregation  
- GDD calculation logic  
- Easter date feature integration  
- Regression modeling  

**Deployment**
- Hosted via Lovable  

---

## Design Decisions

- Chose regression over neural networks to preserve explainability  
- Incorporated Easter as a feature due to production dependency  
- Prioritized deterministic outputs for operational reliability  
- Used simplified NOAA historical datasets for initial calibration  

---

## Future Improvements

- Real-time NOAA API integration  
- Region-specific calibration  
- Probabilistic forecasting bands  
- Multi-variable environmental modeling (light + humidity)  

---

## Broader Application

This modeling framework generalizes to temperature-dependent production systems, harvest scheduling, and seasonal operational planning problems.

---

Built and maintained by Paige Miller
