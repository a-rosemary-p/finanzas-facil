-- ============================================================
-- FinanzasFácil v0.2 — Schema inicial
-- Ejecutar en Supabase Dashboard → SQL Editor
-- ============================================================

-- ============================================================
-- TABLAS
-- ============================================================

CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT NOT NULL,
  display_name TEXT,
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  subscription_status TEXT DEFAULT 'none' CHECK (subscription_status IN ('none', 'active', 'past_due', 'canceled')),
  movements_today INTEGER DEFAULT 0,
  movements_today_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  raw_text TEXT NOT NULL,
  input_source TEXT DEFAULT 'text' CHECK (input_source IN ('text', 'voice', 'photo')),
  entry_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.movements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_id UUID REFERENCES public.entries(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('ingreso', 'gasto', 'pendiente')),
  amount DECIMAL(12,2) NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'Ventas', 'Ingredientes', 'Servicios', 'Transporte',
    'Renta', 'Servicios básicos', 'Otro'
  )),
  movement_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES
-- ============================================================

CREATE INDEX idx_entries_user_date ON public.entries(user_id, entry_date DESC);
CREATE INDEX idx_movements_user_date ON public.movements(user_id, movement_date DESC);
CREATE INDEX idx_movements_user_type ON public.movements(user_id, type);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movements ENABLE ROW LEVEL SECURITY;

-- Cada usuario solo ve/edita/borra sus propios datos
CREATE POLICY "own_data" ON public.profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "own_data" ON public.entries FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_data" ON public.movements FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- TRIGGER: Crear profile automáticamente al registrarse
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    SPLIT_PART(NEW.email, '@', 1)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- TRIGGER: Contar movimientos diarios por usuario
-- ============================================================

CREATE OR REPLACE FUNCTION public.count_daily_movements()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT movements_today_date FROM public.profiles WHERE id = NEW.user_id) < CURRENT_DATE THEN
    -- Nuevo día: resetear contador
    UPDATE public.profiles
    SET movements_today = 1, movements_today_date = CURRENT_DATE
    WHERE id = NEW.user_id;
  ELSE
    -- Mismo día: incrementar
    UPDATE public.profiles
    SET movements_today = movements_today + 1
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_movement_created
  AFTER INSERT ON public.movements
  FOR EACH ROW EXECUTE FUNCTION public.count_daily_movements();
